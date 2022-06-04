<?php
/**
 * DesignController.php
 *
 * This class supports the actions for design page.
 * 
 * @author Austin L <auslee986@gmail.com>
 * @version 1.0
 */

BLoader::import_helper('image');

class DesignController extends Controller {
    /**
     * Constructor.
     */
    public function __construct($opts)
    {
        // for phrases loading
        $opts['phrases'] = array(
            'global',
            'flyup',
            'publish',
            'header',
            'sidebar',
            'pagination',
            'tip',
            'crop',
            'error', // all above are globally loaded
            'design', // this is only for current page
            'wizard', // for color scheme
            //'build',
        );

        $opts['phrases_js'] = [
        	'global',
        	'flyup',
        	'publish',
        	'design',
        ];
        
        parent::__construct($opts);

        $this->rules = array(
            '*' => 'auth.client_loggedin'
        );

        $this->init_dashboard('edit', 'edit_design');
    }

    protected function _get_shortcuts()
    {
        BLoader::import("home_sub_tabs");

        $app_id = $this->app["id"];
        $app_code = $this->app["code"];

        $shortcuts = HomeSubTabsModel::get_home_sub_tabs_by_app_id($app_id);
        foreach($shortcuts as $k => &$item) {
            $url = "";
            if ($item["Custom_Icon"] == 1) {
                $img_file = FileHelper::find_upload_dir($app_id, "cutom_icon") . "/".$item["id"].".png";

                if (file_exists($img_file)) {
                    $url = FileHelper::imggpath($img_file, '/custom_images/'.$app_code.'/'.$item["id"].'.png?extra=cutom_icon');
                }

                if (SecureHelper::_is_link($img_file)) {
                    $filename = SecureHelper::_readlink($img_file);
                } else {
                    $filename = $url;
                }
            } else {
                if ($item["TabImage"]) {
                    $url = "/images/subtabicons/".$item["TabImage"];
                } else {
                    $url = ImageHelper::get_no_image_url("shortcut");
                }

                $filename = $url;
            }

            $qpos = strpos($filename, "?");
            if ($qpos !== false) {
                $filename = substr($filename, 0, $qpos);
            }

            $item["is_active"] = intval($item["is_active"]);
            $item["is_hide"] = intval($item["is_hide"]); // this means that is homescreen_widget_only in shortcut overlay
            
            /* shortcut item will be hide if message tab value1 is "hide" - Douglas */
            $item['hide'] = ($item['value1'] == "hide" ? 1 : 0);
            // unset($item['value1']);

            $item["icon"] = [
                "url" => $url,
                "filename" => pathinfo($filename, PATHINFO_BASENAME)
            ];

            $item["icon"]["id"] = ImageHelper::get_id($item["icon"]["filename"],  ($item["Custom_Icon"] == 1) ? "custom" : "lib");
            if ($item["icon"]["id"] == "") {
                $item["icon"]["id"] = "g_no_button";
                $item["icon"]["filename"] = "no_button.png";
                $item["icon"]["url"] = ImageHelper::get_no_image_url("shortcut");
            }
        }
        return $shortcuts;
    }

    /**
     * Show design page.
     * @return html
     */
    public function display()
    {
        $db = DbModel::get_instance();

        BLoader::import('app_tabs, sliding_link, template_app, template_color, apps, images_bg, app_meta');
        BLoader::import_helper('array, svg, app_tabs, mail');

        // Global javascript variable to pass data from PHP to javascript
        $g_vars = array();

        $app = $this->get_app();
        
        $partnerapp = intval($app['admin_user_id']) > 0 ? 1 : 0;
        
        $app_id = $app['id'];
        $app_code = $app['code'];

        $xtr = ImageHelper::get_xtr($app_id);

        $app_xtrs = $xtr["xtr"];
        $app_xtrs_v2 = $xtr["xtr2"];
        $template_detail = $xtr["template_detail"];
        
        if (empty($template_detail)) {
            $template_detail = [
                'btn_layout' => 'bottom',
                'home_header' => '',
                'rows' => 0,
                'cols' => 0,
                'tab_showtext' => '',
                'with_moreview' => false,
                'feature_button' => '',
                'navbar_bg' => '',
                'nav_text' => '',
                'tab_icon' => '',
                'tab_icon_color' => '',
                'tab_font' => 'Arial',
                'tab_tint' => '',
                'tab_tint_opacity' => 0,
                'header_tint' => '',
                'header_tint_opacity' => 0,
                'global_header_tint' => '',
                'global_header_tint_opacity' => 0,
                'blur_effect' => 0,
            ];
        }

        // Opacity in 0 ~ 1
        foreach($template_detail as $k => $v) {
            if (preg_match("/_opacity$/", $k)) {
                $template_detail[$k."_value"] = $v / 100.0;
            }
        }

        $app_date = $app["date_joined"];
        $recentapp = self::checkRecentApp($app_date);

        // iOS status bar
        $with_status_bar = intval($app_xtrs['with_status_bar']);

        // Dummy values
        $blur_home_screen = $blur_more_tab = $blur_global_v2 = 0;

        // Blur Effect
        if ($template_detail["blur_effect"]) {
            $blur_global_v2 = 1;    // Design / Feature Background
            $blur_more_tab = 1;     // Build / Model - for all tabs
        } else {
            $blur_global_v2 = $app_xtrs["blur_global_v2"];
            $blur_more_tab = $app_xtrs["blur_more_tab"];
        }
        
        // Home screen blur option would be independent from the global blur option. 07/11/2016 by Daniel Lu
        $blur_home_screen = $app_xtrs["blur_home_screen"];
        
        // Set the additional buttons.
        $allowed_additional_btns = '';
        if ($app['onbtncall']) {
            $allowed_additional_btns .= '1';
        }
        if ($app['onbtndirection']) {
            $allowed_additional_btns .= '2';
        }
        if ($app['onbtntell']) {
            $allowed_additional_btns .= '3';
        }

        // ASCII Art:  Fontname  [JS Stick Letters]
        // http://patorjk.com/software/taag/#p=display&f=JS%20Stick%20Letters&t=
        $dimensions = ImageHelper::get_all_dimensions();
        $g_vars["dimensions"] = $dimensions;


        ############################################################################
        #                                   __       ___    __
        #                 |\ |  /\  \  / | / _`  /\   |  | /  \ |\ |
        #                 | \| /~~\  \/  | \__> /~~\  |  | \__/ | \|
        #
        ############################################################################
        // 0: left, 1: top, 2: right, 3: bottom
        $btn_layout = $template_detail["btn_layout"];
        // 0: traditional, 1: slider list, 2: slider tiles
        $home_layout = $app_xtrs["home_layout"];

        $nav_type = $nav_subtype = '';
        if ($home_layout == 0) {
            if ($btn_layout == BTN_LAYOUT_BOTTOM) {
                $nav_type = "bottom";
            } else if ($btn_layout == BTN_LAYOUT_TOP) {
                $nav_type = "top";
            } else if ($btn_layout == BTN_LAYOUT_LEFT || $btn_layout == BTN_LAYOUT_RIGHT) {
                $nav_type = "edges";
                $nav_subtype = ($btn_layout == BTN_LAYOUT_LEFT ? "left" : "right");
            }
        } else {
            $nav_type = "sliding";
            if ($home_layout == HOME_LAYOUT_SLIDER_LIST) {
                $nav_subtype = "list";
            } else if ($home_layout == HOME_LAYOUT_SLIDER_TILES) {
                $nav_subtype = "tile";
            }
        }

        $nav_type_full = $nav_type;
        if ($nav_subtype) {
            $nav_type_full .= '_'.$nav_subtype;
        }


        $available_nav_types = array("bottom, top, edges, sliding");
        $nav_types = array(
            'bottom' => $this->phrases["design_label_navigation_type_bottom"],
            'top' => $this->phrases["design_label_navigation_type_top"],
            'edges' => $this->phrases["design_label_navigation_type_side_edges"],
            'sliding' => $this->phrases["design_label_navigation_type_sliding"],
        );

        // Rows & Cols
        $rows = array(
            1 => "1",
            2 => "2",
            3 => "3",
            4 => "4"
        );
        $cols = array(
            3 => "3",
            4 => "4",
            5 => "5"
        );

        // Flag whether rows > 1
        $is_multi_row = false;

        // Flag whether Row(s) selectbox should be displayed
        $is_show_rows = false;

        if ($nav_type == "bottom" && $template_detail["with_moreview"] == 0){
            $is_show_rows = true;
            if ($template_detail["rows"] > 1) {
                $is_multi_row = true;
            }
        }

        // More Menu
        // Check the app signup date 05/22/2016
        $more_tab = AppTabsHelper::prepare_more_tab($app_id, $template_detail, $app_date);

        if ($more_tab["tab_icon_key"] != "")
            $tab_icon_shadow = ImageHelper::get_tab_icon($app_id, $more_tab["tab_icon_key"], "cccccc");
        else 
            $tab_icon_shadow = "";
        
        $more_tab["tab_icon_url_shadow"] = $tab_icon_shadow["url"];

        ############################################################################
        #                           ___       __   ___  __
        #                     |__| |__   /\  |  \ |__  |__)
        #                     |  | |___ /~~\ |__/ |___ |  \
        #
        ############################################################################
        $home_header   = ImageHelper::get_image_set($app_id, "home_header");
        $global_header = ImageHelper::get_image_set($app_id, "global_header");

        $is_home_header_empty = false;
        if ($home_header["active"]["filename"] == "no_header.png") {
            $is_home_header_empty = true;
        }
        $this->assign("is_home_header_empty", $is_home_header_empty);

        $g_vars["home_header"]   = $home_header;
        $g_vars["global_header"] = $global_header;


        $header_industry_options = ImageHelper::get_industry_names("header");
        $g_vars["header_industry_options"] = $header_industry_options;

        ############################################################################
        #             __        __        __   __   __             __
        #            |__)  /\  /  ` |__/ / _` |__) /  \ |  | |\ | |  \
        #            |__) /~~\ \__, |  \ \__> |  \ \__/ \__/ | \| |__/
        #
        ############################################################################
        $bg_lib = ImageHelper::get_library_images($app_id, "bg");
        $bg_industry_options = $bg_lib["industry_options"];

        $g_vars["bg"] = array(
            //"default" => $bg_lib["default"],
            "no_image" => [
                "phone" => ImageHelper::get_no_image("bg", ["device" => "phone"]),
                "tablet" => ImageHelper::get_no_image("bg", ["device" => "tablet"]),
            ],
            "lib" => $bg_lib["industry_bg_images"],
            "custom" => array(
                "phone"  => ImageHelper::get_custom_images($app_id, "bg", array("device" => "phone")),
                "tablet" => ImageHelper::get_custom_images($app_id, "bg", array("device" => "tablet")),
            )
        );

        // List of pairs (industry_name, industry_id)
        // e.g:  Artist Gallery => 19
        $g_vars["bg_industries"] = $bg_industry_options;

        if ($app["ipad_bg_set_mode"] == 1) {
            $device = array("phone", "phone");
        } else {
            $device = array("phone", "tablet");
        }

        $home_bg_phone = ImageHelper::get_active_image($app_id, "home_bg", array("device" => "phone"));
        $home_bg_tablet = ImageHelper::get_active_image($app_id, "home_bg", array("device" => "tablet"));

        $g_vars["home_bg"] = $home_bg = array(
            "phone" => array(
                "active"  => $home_bg_phone,
            ),

            "tablet" => $app["ipad_bg_set_mode"] == 1 ? array(
                "active" => array(
                    "id"        => $home_bg_tablet["id"],
                    "filename"  => $home_bg_tablet["filename"],
                    "url"       => $home_bg_phone["url"],
                    "real_url"  => $home_bg_phone["real_url"]
                    )
            ) : array(
                "active" => $home_bg_tablet
            )
        );
        
        $global_bg_phone = ImageHelper::get_active_image($app_id, "global_bg", array("device" => "phone"));
        $global_bg_tablet = ImageHelper::get_active_image($app_id, "global_bg", array("device" => "tablet"));

        $g_vars["global_bg"] = $global_bg = array(
            "phone" => array(
                "active"  => $global_bg_phone,
            ),
            "tablet" => $app["ipad_bg_set_mode"] == 1 ? array(
                "active" => array(
                    "id"        => $global_bg_tablet["id"],
                    "filename"  => $global_bg_tablet["filename"],
                    "url"       => $global_bg_phone["url"],
                    "real_url"  => $global_bg_phone["real_url"]
                    )
            ) : array(
                "active" => $global_bg_tablet
            )
        );

        ############################################################################
        #                     __          __   ___  __
        #                    /__` |    | |  \ |__  |__)
        #                    .__/ |___ | |__/ |___ |  \
        #
        ############################################################################
        $slider_lib = ImageHelper::get_library_images($app_id, "slider");

        $sliding_mode_iphone5 = 0;
        if ($app["sliding_type_iphone5"] > 0) {
            $sliding_mode_iphone5 = ($app["ismoderniphone5sliding"] ? "m" : "n") . $app["sliding_type_iphone5"];
        }
        $sliding_mode_ipad = 0;
        if ($app["sliding_type_ipad"] > 0) {
            $sliding_mode_ipad = ($app["ismodernipadsliding"] ? "m" : "n") . $app["sliding_type_ipad"];
        }
        $g_vars["slider"] = [
            "lib" => $slider_lib["industry_bg_images"],
            "phone" => [
                "active"  => ImageHelper::get_active_image($app_id, "slider", array("device" => "phone")),
                "custom"  => ImageHelper::get_custom_images($app_id, "slider", array("device" => "phone")),
                "sliding_mode" => $sliding_mode_iphone5,
            ],
            "tablet" => [
                "active" => ImageHelper::get_active_image($app_id, "slider", array("device" => "tablet")),
                "custom" => ImageHelper::get_custom_images($app_id, "slider", array("device" => "tablet")),
                "sliding_mode" => $sliding_mode_ipad,
            ]
        ];
        
        // Active tabs to be shown in Tab option in SLIDE LINK TAB
        // We will still display tabs even app is inactive.
        $active_tabs = AppTabsModel::load_active_tabs($app_id, false, true);

        // Get slider links
        for($i=1; $i<=5; $i++) {
            $defaults = array(
                "link_tab_id" => 0,
                "link_cat_id" => 0,
                "link_detail_id" => 0,
                "depth" => 0,
                "is_active" => 0
            );

            $link_tab_phone = SlidingLinkModel::get_sliding_link_tab($app_id, 0, $i, "phone");
            $link_tab_tablet = SlidingLinkModel::get_sliding_link_tab($app_id, 0, $i, "tablet");
            $g_vars["slider"]["phone"]["active"][$i]["link_tab"] = $link_tab_phone ? $link_tab_phone : $defaults;
            $g_vars["slider"]["tablet"]["active"][$i]["link_tab"] = $link_tab_tablet ? $link_tab_tablet : $defaults;
        }

        ############################################################################
        #                __        __   __  ___  __       ___  __
        #               /__` |__| /  \ |__)  |  /  ` |  |  |  /__`
        #               .__/ |  | \__/ |  \  |  \__, \__/  |  .__/
        #
        ############################################################################
        $g_vars["shortcuts"] = $shortcuts = self::_get_shortcuts();
        $this->assign("shortcuts", $shortcuts);

        // Show Shortcuts in Tablet only
        $home_tab = $db->search("app_tabs", array("view_controller" => "HomeViewController", "app_id" => $this->app["id"]), "first");
        $home_tab_id = 0;
        if ( !empty($home_tab) ) {
            $home_tab_id = $home_tab["id"];
        }

        $ignore_tabs = array(
            "HomeViewController",
            "MembershipManageController",
            "GoogleAdsViewController",
            "InstructionViewController"
        );

        $app_id = $this->get_app_id();

        // Get all active tabs only
        $app_tabs = AppTabsModel::get_app_tabs($app_id, 0);
        $app_tabs_info = AppTabsHelper::prepare_tabs($app_id, $app_tabs, $template_detail, true);

        foreach ($app_tabs_info["preview_tabs"] as &$app_tab_info) {

            if ($app_tab_info["tab_icon_key"] != "")
                $tab_icon_shadow = ImageHelper::get_tab_icon($app_id, $app_tab_info["tab_icon_key"], "cccccc");
            else 
                $tab_icon_shadow = array("type" => "", "file" => "", "url" => "");

            $app_tab_info["tab_icon_url_shadow"] = $tab_icon_shadow["url"];
        }

        $n_previews = count($app_tabs_info["preview_tabs"]);
        $n_sliding_previews = $n_previews;
        if ($n_previews > 20) {
            $n_previews = 20;
        }

        if ($n_sliding_previews > 10) {
            $n_sliding_previews = 10;
        }
        
        $this->assign("app_tabs", $app_tabs_info["tabs"]);
        $this->assign("n_previews", $n_previews);
        $this->assign("n_sliding_previews", $n_sliding_previews);
        $this->assign("app_preview_tabs", $app_tabs_info["preview_tabs"]);
        $g_vars["app_preview_tabs"] = $app_tabs_info["preview_tabs"];

        ############################################################################################
        #    When you visit Design page, just check if the directory Custom (v2) is empty.
        #    If empty, then copy all PNG files from Custom (v1) to Custom (v2) to ensure that the
        #   custom shortcut icons that client uploaded in cms v1 should be available in v2 as well.
        ############################################################################################
        // https://biznessapps.atlassian.net/wiki/display/DWS/V1+%3D%3E+V2+Conversion+Scripts

        // Sep 28, 2015 - Disabled from request of Raymond C.
        //ImageHelper::copy_shortcuts_v1_to_v2($app_id);

        // Load shortcut icons
        // As for already existing icons, we have to load icons from v1 directory to ensure backward compatibility
        // And we have to make sure to copy uploaded custom icons from Custom v2 directory to Custom v1 directory
        $is_release_flyup_freeze = ArrayHelper::is_release_flyup_freeze($this->app["code"]);
        $shortcut_v2 = ImageHelper::get_shortcut_set($app_id);
        
        if (!$is_release_flyup_freeze) {
            $shortcut_v2["no_image"]["filename"] = "no_button.png";
            $shortcut_v2["no_image"]["url"] = "/images/theme_editor/no_button.png";  
        }

        $g_vars["shortcut_v2"] = $shortcut_v2;

        $shortcut_industry_options = ImageHelper::get_industry_names("shortcut");
        $g_vars["shortcut_industry_options"] = $shortcut_industry_options;


        ############################################################################
        # Jul 26, 2015 - Austin.
        #                  __   __           __   __        __   __
        #               | /  ` /  \ |\ |    /  ` /  \ |    /  \ |__)
        #               | \__, \__/ | \|    \__, \__/ |___ \__/ |  \
        #
        ############################################################################

        // For each template_detail of this App, generate template_detail.tab_icon_color from v1 field template_detail.tab_icon
        // template_detail.tab_icon is the color folder name (1 ~ 55) or some color name like "grey" or "blue"
        $details = $db->search("template_detail", array(
            "app_id" => $app_id,
            "tab_icon_color" => ""
        ));

        // template_app
        $app_template_id = $db->search_cell("detail_id", "template_app", ["app_id" => $app_id]);

        // template_tab
        $template_tabs = $db->search("template_tab", ["app_id" => $app_id], "all", "", "detail_id");

        foreach($details as $detail) {
            // Migrate v1's tab_icon to v2's tab_icon_color
            $hex = SvgHelper::colorname2hex($detail["tab_icon"]);
            if ($hex) {
                $db->update("template_detail", array("tab_icon_color" => $hex), array("id" => $detail["id"]));
                if ($detail["id"] == $app_template_id) {
                    $template_detail["tab_icon_color"] = $hex;
                    $xtr["template_detail"] = $template_detail;

                    // Save to cache
                    ImageHelper::set_xtr($app_id, "", $xtr);
                } else if (isset($template_tabs[$detail["id"]])) {
                    $tab_id = $template_tabs[$detail["id"]]["tab_id"];
                    $tab_xtr = [
                        "template_detail" => $template_detail
                    ];

                    $tab_xtr["template_detail"]["tab_icon_color"] = $hex;

                    // Save to cache
                    ImageHelper::set_xtr($app_id, $tab_id, $tab_xtr);
                }
            }
        }

        $icon_color = ImageHelper::get_icon_color_set($app_id, $template_detail);
        $g_vars["icon_color"] = $icon_color;

        ############################################################################
        #       __   __           __        __        __   __   __             __
        #    | /  ` /  \ |\ |    |__)  /\  /  ` |__/ / _` |__) /  \ |  | |\ | |  \
        #    | \__, \__/ | \|    |__) /~~\ \__, |  \ \__> |  \ \__/ \__/ | \| |__/
        #
        ############################################################################
        $tab_button = ImageHelper::get_image_set($app_id, "tab_button");
        $g_vars["tab_button"] = $tab_button;

        $tab_button_industry_options = ImageHelper::get_industry_names("tab_button");
        $g_vars["tab_button_industry_options"] = $tab_button_industry_options;

        ############################################################################
        #                             ___  __       ___
        #                            |__  /  \ |\ |  |
        #                            |    \__/ | \|  |
        #
        ############################################################################
        $font_names = ArrayHelper::get_font_list();
        // Get the font list from phrases.
        $font_list = array();
        foreach ($font_names as $key => $font_name) {
            $font_phrase_key = 'design_label_font_' . str_replace('-', '_', strtolower($font_name));
            $font_list[$key] = $this->phrases[$font_phrase_key];
        }

        ############################################################################
        #           __   __        __   __     ___       ___        ___
        #          /  ` /  \ |    /  \ |__)     |  |__| |__   |\/| |__
        #          \__, \__/ |___ \__/ |  \     |  |  | |___  |  | |___
        #
        ############################################################################
        $color_themes = TemplateColorModel::load_all();

        foreach($color_themes as $k => $item) {
			$phrase_key = $item['phrase_key'];
			if ( isset($this->phrases[$phrase_key]) ) {
				$color_themes[$k]['phrase_words'] = $this->phrases[$phrase_key];
			} else {
				$color_themes[$k]['phrase_words'] = $item['name'];
			}
		}
		
        $g_vars["color_themes"] = $color_themes;

        if ($template_detail['color_theme']) {
            $color_theme_id = $template_detail['color_theme'];
            $g_vars['color_theme_id'] = $template_detail['color_theme'];
        } else {
            $g_vars['color_theme_id'] = -1;
            $color_theme_id = -1;
        }

        // Set the template detail.
        $g_vars["template_detail"] = $template_detail;

        // Set the tab Icon
        $g_vars["tab_icon"] = $template_detail["tab_icon"];
        $tab_icon = $template_detail["tab_icon"];
        if ( $tab_icon == '' || $tab_icon == "empty") {
            $show_tab_icon = '0';
        } else {
            $show_tab_icon = '1';
        }
        
        // Check i4 bg exist in i4 section, should consider for old app.
        if (BizHelper::is_recentapp($app_id, $app_date)) {
            AppsModel::set_i4_bg_cp_status($app_id, 1);
            $check_i4_assigned = false;
        } else {
            $check_i4_assigned = ImageHelper::check_mobile_bgExistence($app_id);    
        }

        //Lower Case, FFFFFF
        $app_xtrs["global_background_color"] = strtolower($app_xtrs["global_background_color"]);
        $app_xtrs_v2["home_bg_color"] = strtolower($app_xtrs_v2["home_bg_color"]);

        //Design First Visit, Secon Visit
        $visit = array();
        $visit = json_decode(AppMetaModel::load_field($app_id, "visit"), true);

        if(!isset($visit['design_tutorial']) || $visit['design_tutorial'] == '0') {
            $first_visit_tutorial = 1;
        }
        else {
            $first_visit_tutorial = 0;
        } 

        if($visit['design_page'] == '1') {
            $second_visit_design = 1;
        }
        else {
            $second_visit_design = 0;
        }  

        /* Applause Modal */
        $applause_hide = $app["applause_hide"];

        $g_vars = str_replace('bizapps', 'root_path', json_encode($g_vars));
        $encoded_g_vars = addslashes($g_vars);
        $this->assign("g_vars",  $encoded_g_vars);

        $this->assign_bulk(compact(
            'app_xtrs', 'app_xtrs_v2',
            'with_status_bar', 'allowed_additional_btns',
            'blur_home_screen', 'blur_more_tab', 'blur_global_v2',
            'nav_types', 'nav_type', 'nav_subtype', 'nav_type_full',
            'rows', 'cols',
            'is_multi_row', 'is_show_rows',

            'more_tab', 'active_tabs', 'app_tabs_info', 'check_i4_assigned',

            'home_header', 'global_header',
            'home_bg', 'global_bg', 'bg_industry_options',
            'home_tab_id',

            'dimensions',
            'shortcut', 'shortcut_industry_options',
            'icon_color',
            'tab_button', 'tab_icon', 'show_tab_icon',
            'font_list',
            'color_themes', 'color_theme_id',
            'template_detail',
            'recentapp', 'applause_hide',
            'partnerapp', 'header_industry_options', 'tab_button_industry_options'
        ));

        $this->assign('first_visit_tutorial', $first_visit_tutorial);
        $this->assign('second_visit_design', $second_visit_design);

        // Identify the design page for Jira Submission Location.(David A)
        $this->assign('submission_location', get_site_url() . $this->base_cms_url . "/design");

        // Remove and adjust some text in hire a designer step(CV-2255).
        // Check biz partner
        /*
        if ($this->is_biz_partner) {
            $this->assign('only_cms', true);
        }*/

        $this->assign('only_cms', true);

        // Add conversion ruler script to design page when is taken from onboarding(SER-5240).
        BLoader::import_helper('analytics');
        if (isset($_COOKIE['conversion_ruler_onboarding']) && $_COOKIE['conversion_ruler_onboarding']) {
            $this->assign('conversion_ruler_script', AnalyticsHelper::track_conversion_ruler('onboard'));
            setcookie('conversion_ruler_onboarding', '');
        }
    }

    public function load()
    {
        if (getMyInstance() != 'prod') {
            berror();
        }

        $app_id = $this->get_app_id();

        BLoader::import('app_meta');

        $visit = array();
        $visit = json_decode(AppMetaModel::load_field($app_id, "visit"), true);

        if(!isset($visit['design_page'])) {
            $visit['design_page'] = 1;
        }
        else {
            $visit['design_page'] = intval($visit['design_page']) + 1;
        }

        $visit = json_encode($visit);
        AppMetaModel::save_field($app_id, "visit", $visit);

        $industry_maps = ImageHelper::get_industry_maps([
            'shortcut', 'home_header', 'global_header', 'tab_button'
        ]);

        $this->ajax_response(true, [
            'industry_maps' => $industry_maps
        ]);
    }

    /**
    * Jul 6, 2015  - Austin. : Save basic information from Design page
    * Jul 20, 2015 - Austin. : Save image information from flyups
    * Aug 27, 2015 - Austin. : Save sliding_type_iphone5, sliding_type_ipad, ismoderniphone5sliding, ismodernipadsliding of `apps` table
    */
    public function save()
    {
        if (getMyInstance() != "prod") {
            //berror();
        }

        $app_id = $this->app["id"];
        $app = $this->get_app();

        BLoader::import("sliding_link, app_tabs, images_bg, template_app");
        BLoader::import_helper('appTabs');

        $db = DbModel::get_instance();
        $now = DatetimeHelper::now();

        $xtr = ImageHelper::get_xtr($app_id);
        $template_detail = $xtr["template_detail"];

        $switch_fields = array(
            'with_status_bar',
            'tab_showtext',
            'onbtncall', 'onbtndirection', 'onbtntell',
            'm_onbtncall', 'm_onbtndirection', 'm_onbtntell',
            'show_tab_icon',
            'with_moreview',
            'ipad_bg_set_mode'
        );
        foreach($switch_fields as $switch_field) {
            ${$switch_field} = get_var($switch_field, 0);
        }

        $app_date = $app["date_joined"];
        $partnerapp = intval($app['admin_user_id']) > 0 ? 1 : 0;

        if (self::checkRecentApp($app_date) && !$partnerapp) {
            $with_status_bar = 1;            
        }
       
        $color_theme = get_var("color_theme");

        $color_fields = array(
            'tab_text',
            'nav_text', 'nav_text_alt',
            'section_bar', 'section_text',
            'oddrow_bar', 'oddrow_text',
            'evenrow_bar', 'evenrow_text',
            'feature_button', 'navbar_bg',
            'feature_text',
            'header_tint',
            'tab_icon_color',
            'tab_tint',
            'global_header_tint'
        );

        foreach($color_fields as $color_field) {
            $default_color = 'FFFFFF';
            if ($color_field == "feature_text") {
                $default_color = '000000';
            }

            ${$color_field} = get_var($color_field, $default_color);
        }

        $device_types = ["phone", "tablet"];
       
        $header_tint_opacity = get_var("header_tint_opacity", 100);
        $global_header_tint_opacity = get_var("global_header_tint_opacity", 100);
        $tab_tint_opacity = get_var("tab_tint_opacity", 100);

        //////////////////////////////////////////////////////////////////////////
        //
        //          App Xtr & App Xtr v2
        //
        //////////////////////////////////////////////////////////////////////////

        // App Icon
        $id = get_var("app_icon");
        $filename = get_var("app_icon_filename");
        ImageHelper::update_real_image($app_id, "app_icon", $id, $filename);
        $xtr["xtr2"]["app_icon"] = array(
            "id" => $id,
            "filename" => $filename
        );

        // Splash
        $xtr["xtr2"]["splash"] = array();

        // --- Splash phone
        $id = get_var("splash_phone");
        $filename = get_var("splash_phone_filename");
        ImageHelper::update_real_image($app_id, "splash", $id, $filename, "phone");
        $xtr["xtr2"]["splash"]["phone"] = array(
            "id" => $id,
            "filename" => $filename
        );

        // --- Splash tablet
        $id = get_var("splash_tablet");
        $filename = get_var("splash_tablet_filename");
        ImageHelper::update_real_image($app_id, "splash", $id, $filename, "tablet");
        $xtr["xtr2"]["splash"]["tablet"] = array(
            "id" => $id,
            "filename" => $filename
        );

        // Home Screen Background Color - @since v2
        $xtr["xtr2"]["home_bg_color"] = get_var("home_bg_color");
        $global_background_color = get_var("global_bg_color");

        // Nav types (as well as rows, cols)
        $rows = get_var("rows", 1);
        $cols = get_var("cols", 3);

        $nav = get_var("nav");
        $nav_type = $nav["navType"];
        $nav_subtype = $nav["navSubtype"];

        $home_layout = HOME_LAYOUT_TRADITIONAL;
        $btn_layout = BTN_LAYOUT_BOTTOM;
        if ($nav_type == "bottom") {
            $home_layout = HOME_LAYOUT_TRADITIONAL;
            $btn_layout = BTN_LAYOUT_BOTTOM;
        } else if ($nav_type == "top") {
            $home_layout = HOME_LAYOUT_TRADITIONAL;
            $btn_layout = BTN_LAYOUT_TOP;
        } else if ($nav_type == "edges") {
            $home_layout = HOME_LAYOUT_TRADITIONAL;
            $btn_layout = $nav_subtype == "left" ? BTN_LAYOUT_LEFT : BTN_LAYOUT_RIGHT;
        } else if ($nav_type == "sliding") {
            if ($nav_subtype == "tile") {
                $home_layout = HOME_LAYOUT_SLIDER_TILES;
            } else if ($nav_subtype == "list") {
                $home_layout = HOME_LAYOUT_SLIDER_LIST;
            }
        }

        // Get template detail id
        $row = $db->search_by_id("template_app", $app_id, "app_id");
        if (empty($row["detail_id"])) {
            // In case of not recent apps.
            if (!self::checkRecentApp($app_date)) {
                $sam_tab_icon_col = '7b7b7b';
                $template_detail_id = TemplateAppModel::insert_template_detail($sam_tab_icon_col);
            } else {
                $this->ajax_failed($this->phrases['design_label_invalid_template_detail_id']);
            }
        } else {
            $template_detail_id = $row["detail_id"];
        }

        //////////////////////////////////////////////////////////////////////////
        //
        //          Slider
        //
        //////////////////////////////////////////////////////////////////////////
        $slider = get_var("slider");

        // New slide number marks
        $flyup_seqs = [
            'phone' => [],
            'tablet' => []
        ];

        $cache_filenames = [
            'phone' => [],
            'tablet' => []
        ];

       
        foreach($device_types as $device) {
            $info = $slider[$device];

            if ( !in_array($device, $device_types) || !isset($info["slides"]) ) {
                continue;
            }

            $dim = ImageHelper::get_dimension("slider", $device);

            $slides = $info["slides"];
            foreach($slides as $seq => $slide) {
                // seq: 1 ~ 5
                $flyup_seq = 6 - $seq;

                if ($flyup_seq < 1 || $flyup_seq > 5) {
                    continue;
                }

                $default = [
                    'id' => '',
                    'filename' => '',
                    'tabtype' => '',
                    'url' => '',
                    'real_url' => ''
                ];

                $slide = array_merge($default, $slide);

                $slide["seq"] = $seq;

                $url = $slide["url"];

                // Save slide bg image if updated
                if (!empty($slide["tabtype"]) && $slide["tabtype"] == "lib") {
                    // If this image was not ever downloaded
                    if (empty($cache_filenames[$device][$url])) {
                        // Copy source image to custom directory
                        //www.biznessapps.com/industry_bg_images.php?img=Health+and+Fitness%2Fi5%2Fhealth_fitness_03.png&modified=&v=1.1.1.82
                        $ret = ImageHelper::curl_remote_image($app_id, "slider", array(
                            "device" => $device,
                            "url" => $url
                        ));
                        if (!$ret["success"]) {
                            $this->ajax_failed($ret["msg"]);
                        }

                        $slide["filename"] = $ret["filename"];
                        $cache_filenames[$device][$url] = $ret["filename"];
                    } else {
                        $slide["filename"] = $cache_filenames[$device][$url];
                    }

                    /**
                    * If you run "$('.tablet-only .slide-5').data()", you will get:
                    *
                    *   filename: "legal_field_01.png"
                    *   id: "g_legal_field_01"
                    *   realUrl: "//www.biznessapps.com/industry_bg_images.php?img=Legal+Field%2FiPad%2Flegal_field_01.png&modified=&v=1.1.3.856"
                    *   tabtype: "lib"
                    *   url: "//www.biznessapps.com/industry_bg_images.php?img=Legal+Field%2FiPad%2Flegal_field_01.png&width=168&height=224&modified=&v=1.1.3.856"
                    *
                    *
                    * This should be updated to the following: (for iphone)
                    *
                    *    filename: "custom_bg.png"
                    *    id: "custom_bg"
                    *    realUrl: "/custom_images/DonFrank/iphone5/custom_bg25.png?a=wh&v=1.1.3.856"
                    *    tabtype: "custom"
                    *    url: "/custom_images/DonFrank/iphone5/custom_bg25.png?width=126&height=224&a=wh&v=1.1.3.856"
                    */

                    $flyup_url = ImageHelper::get_custom_image_url($app_id, "slider", [
                        "filename" => $slide["filename"],
                        "device" => $device,
                        "width" => $dim["thumb"]["width"],
                        "height" => $dim["thumb"]["height"],
                        "a" => "wh"
                    ]);

                    $real_url = ImageHelper::get_custom_image_url($app_id, "slider", [
                        "filename" => $slide["filename"],
                        "device" => $device
                    ]);

                    $flyup_seqs[$device][$flyup_seq] = [
                        "filename" => $slide["filename"],
                        "id" => ImageHelper::get_id($slide["filename"]),
                        "tabtype" => "custom",
                        "url" => $flyup_url,
                        "realUrl" => $real_url
                    ];
                    
                }

                // Save image to images_bg
                $whr = array(
                    "app_id" => $app_id,
                    "device_type" => ImageHelper::get_device_type_v1($device),
                    "detail_type" => IMAGE_DETAIL_SLIDER,
                    "detail_id" => 0,
                    "seq" => $seq
                );

                $row = ImageHelper::get_images_bg_rows($app_id, $whr);
                if ($row) {
                    $db->update("images_bg", array("name" => $slide["filename"]), $whr);
                } else {
                    $whr["name"] = $slide["filename"];
                    $db->insert("images_bg", $whr);
                }

                // Save link tab detail
                SlidingLinkModel::save_sliding_link_tab($app_id, $device, $slide);
            }
        }

        $app_fields = compact(
            'onbtncall', 'onbtndirection', 'onbtntell',
            'm_onbtncall', 'm_onbtndirection', 'm_onbtntell'
        );

        $sliding_mode = [];
        $is_modern_sliding = [];
        foreach($device_types as $device) {
            $sliding_mode[$device] = 0;
            $is_modern_sliding[$device] = 0;

            if ($slider[$device]["sliding_mode"] != "0") {
                if ($slider[$device]["sliding_mode"][0] == "m") {
                    $is_modern_sliding[$device] = 1;
                }

                $sliding_mode[$device] = $slider[$device]["sliding_mode"][1];
            }
        }

        $app_fields["sliding_type_iphone5"] = $sliding_mode["phone"];
        $app_fields["ismoderniphone5sliding"] = $is_modern_sliding["phone"];

        if ($ipad_bg_set_mode == 1) {
            $app_fields["sliding_type_ipad"] = $sliding_mode["phone"];
            $app_fields["ismodernipadsliding"] = $is_modern_sliding["phone"];
            $app_fields["mobile_bg_set_mode"] = 1;
        } else {
            $app_fields["sliding_type_ipad"] = $sliding_mode["tablet"];
            $app_fields["ismodernipadsliding"] = $is_modern_sliding["tablet"];
        }

        $app_fields["ipad_bg_set_mode"] = $ipad_bg_set_mode;

        // Additional Buttons
        if ( !$db->update("apps", $app_fields, array("id" => $app_id)) ) {
            $this->ajax_failed($this->phrases['design_label_failed_update_app_record']);
        }

        // Shortcuts - only for tablets - apps_xtr.only4ipad
        $only4ipad = get_var("only4ipad", 0, "int");
        $home_tab_id = get_var("home_tab_id", 0, "int");

        $blur_home_screen = get_var("blur_home_screen", 0, "int");
        $blur_global_v2 = get_var("blur_global_v2", 0, "int");
        

        // With status bar (on/off), Show Shortcuts on Tablet Only (on/off), Home Layout (0 = traditional, 1 = modern)
        // v2 values
        $apps_xtr_fields = compact(
            "only4ipad",
            "with_status_bar",
            "home_layout",
            "global_background_color",
            "blur_home_screen",
            "blur_global_v2"
        );

        $apps_xtr_fields["v2"] = json_encode($xtr["xtr2"]);

        if ( !AppsModel::insert_app_xtr($app_id, $apps_xtr_fields, true) ) {
            $this->ajax_failed($this->phrases['design_label_failed_update_apps_xtr']);
        }

        if ($home_tab_id) {
            $v3 = array('ipad' => $only4ipad);
            $v3 = serialize($v3);
            if ( !$db->update("app_tabs", array("value3" => $v3), array("app_id" => $app_id, "id" => $home_tab_id)) ) {
                $this->ajax_failed($this->phrases['design_label_failed_update_app_tab']);
            }
        }


         ############################################################################
        #                __        __   __  ___  __       ___  __
        #               /__` |__| /  \ |__)  |  /  ` |  |  |  /__`
        #               .__/ |  | \__/ |  \  |  \__, \__/  |  .__/
        #
        ############################################################################
        /*
        [new1439538901] => Array
            (
                [id] => new1439538901
                [app_id] => 187327
                [tab_id] => 0
                [is_active] => 1
                [is_hide] => 0
                [TabLabelText] => Test123
                [link_tab_id] => 2280144
                [TabLableTextColor] => 000000
                [TabLableTextBackgroundColor] => ffffff
                [TabImage] => 1Chat.png
                [LastUpdated] => 2015-08-14 07:55:01
                [Custom_Icon] => 0
                [icon] => Array(
                    [url] => /images/subtabicons/1Chat.png?v=1.1.1.72
                    [filename] => 1Chat.png
                )
            )
        */
        $shortcuts = get_var("shortcuts");
        $existing_shortcuts = $db->search("home_sub_tabs", array("app_id" => $app_id), "all", "id", "id");

        $field_names = array(
            "app_id", "is_active", "is_hide", "link_tab_id",
            "TabLabelText", "TabLableTextColor", "TabLableTextBackgroundColor",
            "TabImage", "Custom_Icon", "seq"
        );

        $new_shortcut_maps = [];
        if (!empty($shortcuts)) {
            foreach($shortcuts as $sc_id => $shortcut) {
                $fields = array(
                    "LastUpdated" => time(),
                    "tab_id" => $home_tab_id
                );
                foreach($field_names as $field_name) {
                    $fields[$field_name] = $shortcut[$field_name];
                    if ($field_name == "TabLabelText") {
                        $fields[$field_name] = addslashes($fields[$field_name]);
                    }
                }

                $real_shortcut_id = $sc_id;
                if (isset($existing_shortcuts[$sc_id])) {
                    // Update
                    $db->update("home_sub_tabs", $fields, array("id" => $sc_id), 1);
                } else {
                    // Insert new
                    $db->insert("home_sub_tabs", $fields, false);
                    $real_shortcut_id = mysql_insert_id();
                    $shortcut["id"] = $real_shortcut_id;
                    $new_shortcut_maps[$sc_id] = self::_render_shortcut($app_id, $shortcut);
                }

                if ($shortcut["Custom_Icon"]) {
                    // Copy from v2 directory to v1 directory
                    ImageHelper::copy_shortcuts_v2_to_v1($app_id, $real_shortcut_id, $shortcut["TabImage"]);
                }
            }
        }

        // Remove shortcuts that were removed from Design page
        $remove_shortcut_ids = array();

        $dir_v1 = FileHelper::find_upload_dir($app_id, "cutom_icon");
        foreach($existing_shortcuts as $sc_id => $row) {
            if (!isset($shortcuts[$sc_id])) {
                // Remove this one
                $remove_shortcut_ids[] = $sc_id;
                $v1_path = $dir_v1 . '/' . $sc_id . ".png";
                if (SecureHelper::_file_exists($v1_path)) {
                    SecureHelper::_unlink($v1_path);
                };
            }
        }

        if ($remove_shortcut_ids) {
            $db->delete_by_id("home_sub_tabs", $remove_shortcut_ids);
        }

        //////////////////////////////////////////////////////////////////////////
        //
        //          Template Detail
        //
        //////////////////////////////////////////////////////////////////////////

        if ($show_tab_icon) {
            if ($template_detail["tab_icon"] == "empty" || $template_detail["tab_icon"] == "") {
                $tab_icon = "10";
            } else {
                $tab_icon = $template_detail["tab_icon"];
            }
        } else {
            $tab_icon = "empty";
        }

        $tab_font = get_var("tab_font", "Georgia");
        $template_detail_fields = compact(
            "tab_font",
            "tab_showtext", "tab_text",
            "nav_text",     "nav_text_alt",
            "section_bar",  "section_text",
            "oddrow_bar",   "oddrow_text",
            "evenrow_bar",  "evenrow_text",
            "header_tint",  "header_tint_opacity",
            "global_header_tint", "global_header_tint_opacity",
            "tab_tint",  "tab_tint_opacity",
            'feature_button', 'navbar_bg',
            "feature_text",
            "with_moreview",
            "rows",  "cols",
            "color_theme"
        );

        if ($template_detail["tab_icon"] != $tab_icon || $template_detail["tab_icon_color"] != $tab_icon_color) {
            // If changed Icon Color, then update these fields
            // and re-generate tab icons
            $template_detail_fields["tab_icon"] = $tab_icon;
            $template_detail_fields["tab_icon_color"] = $tab_icon_color;

            // Generate tab_icons again
            if ($tab_icon != "empty") {
                ImageHelper::generate_tab_icons($app_id, 0, $tab_icon_color);
            }
            
            // For more tab
            if ( $home_layout == HOME_LAYOUT_TRADITIONAL ) {
                $app_more_tab = $db->search_by_id("app_more_tabs", $app_id, "app_id");
                if ( !$app_more_tab) {
                    $more_tab = AppTabsHelper::prepare_more_tab($app_id, $template_detail);
                    
                    $db->insert("app_more_tabs", array("app_id" => $app_id, "tab_icon_new" => $more_tab['tab_icon_new'], "tab_label" => $more_tab['tab_label'], "last_updated" => $now), true);
                }
                
                ImageHelper::generate_more_tab_icon($app_id, $tab_icon_color);
            }
        }

        // Update navigation layout
        if ($nav_type != "sliding") {
            $template_detail_fields["btn_layout"] = $btn_layout;
        }

        
        //////////////////////////////////////////////////////////////////////////
        //
        //          Home Header, Global Header
        //
        //////////////////////////////////////////////////////////////////////////
        
        // Need to check blank value for no header
        if ( get_var("home_header_filename") == '' ) {
            $template_detail_fields["header_src"] = 'no_header.png';
        } else {
            $template_detail_fields["header_src"] = get_var("home_header_filename");
        }
        
        if ( get_var("global_header_filename") == '' ) {
            $template_detail_fields["global_header"] = 'no header.png';
        } else {
            $template_detail_fields["global_header"] = get_var("global_header_filename");
        }
        
        $tab_button_filename = get_var("tab_button_filename");
        if ($tab_button_filename == "no_button_v2.png") {
            $tab_button_filename = "no_button.png";
        } else if ($tab_button_filename == "") {
            $tab_button_filename = "empty.png";
        }
        $template_detail_fields["tab_src"] = $tab_button_filename;
        $template_detail_fields["blur_effect"] = 0; // always 0 in CMS v2


        $ret = $db->update("template_detail", $template_detail_fields, array("id" => $template_detail_id), 1);
        if (!$ret) {
            $this->ajax_failed($this->phrases['design_label_failed_update_template_detail']);
        }

        /////////////////////////////////////////////////////////////////////////
        //
        //  Get the list of tab_id which use Default Theme
        //
        /////////////////////////////////////////////////////////////////////////

        $row = $db->fetch("SELECT GROUP_CONCAT(id) as tab_ids from app_tabs where app_id = '$app_id' and id NOT IN (SELECT tt.tab_id FROM template_tab tt LEFT JOIN template_detail td ON tt.detail_id = td.id where tt.app_id = '".$app_id."' AND td.id > 0) ORDER BY id", "first");

        $str_default_theme_tab_ids = $row["tab_ids"];
        $default_theme_tab_ids = explode(',', $row["tab_ids"]);

        // Check if More tab uses Default THeme
        $row = $db->fetch("SELECT COUNT(1) AS c FROM template_tab tt LEFT JOIN template_detail td ON tt.detail_id = td.id WHERE tt.app_id = '".$app_id."' AND td.id > 0 AND tt.tab_id = 0");
        $is_more_default_theme = empty($row['0']["c"]); // If it's empty, it means there's no template details for more tab, so it uses global design.
        if ($is_more_default_theme) {
            $default_theme_tab_ids[] = "0";
        }

        // Delete template detail for More tab if we are not using MoreView... /* Douglas */
        // It should be done once check if More tab uses default theme or not.
        if (!$with_moreview) {
            $template_detail_4more = TemplateAppModel::get_template_tab($app_id, 0);
            if (!empty($template_detail_4more)) {
                $db->delete_by_id('template_detail', $template_detail_4more['id']);
            }
        }

        // Update blur_effect for all the tabs using Global Design
        if ($str_default_theme_tab_ids) {
            $db->update("app_tabs", ["blur_effect" => $blur_global_v2], [
                'id' => [$str_default_theme_tab_ids, "%1 IN (%2)"]
            ]);
        }

        if ($is_more_default_theme) {
            $db->update("apps_xtr", ["blur_more_tab" => $blur_global_v2], [
                'app_id' => $app_id
            ]);
        }

        //////////////////////////////////////////////////////////////////////////
        //
        //    images_bg (Home Background, Global Background)
        //
        //////////////////////////////////////////////////////////////////////////
        $bg_types = array("home_bg", "global_bg");
        foreach($bg_types as $bg_type) {
            ${$bg_type} = array();
            foreach($device_types as $device) {
                ${$bg_type}[$device] = array(
                    "id" => get_var($bg_type."_".$device),
                    "filename" => get_var($bg_type."_".$device."_filename"),
                    "real_url" => get_var($bg_type."_".$device."_real_url"),
                );

            }
            
        }

        // if saved from Libary Images, then copy to Your Images and return the new information to auto-select those items.
        $bg_copied = [
            'home_bg' => [],
            'global_bg' => [],
        ];

        // Home bg per device
        foreach ($device_types as $device) {

            $info = $home_bg[$device];

            // Get remote image if chose Library Image
            if (substr($info["id"], 0, 2) == "g_") {
                if ($info["id"] == "g_no_image") {
                    $filename = "";
                } else {
                    $ret = ImageHelper::curl_remote_image($app_id, "home_bg", array(
                        "device" => $device,
                        "filename" => $info["filename"],
                        "url" => $info["real_url"]
                    ));

                    if (!$ret["success"]) {
                        $this->ajax_failed("[Get Remote Image] " . $ret["msg"]);
                    }

                    $filename = $ret["filename"];
                    $bg_copied["home_bg"][$device] = [
                        'filename' => $filename,
                        'id' => ImageHelper::get_id($filename)
                    ];
                }
            } else {
                $filename = $info["filename"];
            }

            $whr = array(
                "app_id" => $app_id,
                "device_type" => ImageHelper::get_device_type_v1($device),
                "detail_type" => IMAGE_DETAIL_TAB,
                "detail_id" => 0,
            );

            $row = ImageHelper::get_images_bg_rows($app_id, $whr);
            if ($row) {
                $db->update("images_bg", array("name" => $filename), $whr);
            } else {
                $whr["name"] = $filename;
                $db->insert("images_bg", $whr);
            }
        }


        // Global bg per device
        foreach ($device_types as $device) {
            $info = $global_bg[$device];

            // Get remote image if chose Library Image
            if (substr($info["id"], 0, 2) == "g_") {
                if ($info["id"] == "g_no_image") {
                    $filename = "";
                } else {
                    $ret = ImageHelper::curl_remote_image($app_id, "global_bg", array(
                        "device" => $device,
                        "filename" => $info["filename"],
                        "url" => $info["real_url"]
                    ));

                    if (!$ret["success"]) {
                        $this->ajax_failed("[Get Remote Image] " . $ret["msg"]);
                    }

                    $filename = $ret["filename"];
                    $bg_copied["global_bg"][$device] = [
                        'filename' => $filename,
                        'id' => ImageHelper::get_id($filename)
                    ];
                }
            } else {
                $filename = $info["filename"];
            }

            $v1_device = ImageHelper::get_device_type_v1($device);
            $whr = array(
                "app_id" => $app_id,
                "device_type" => $v1_device,
                "detail_type" => IMAGE_DETAIL_GLOBAL,
                "detail_id" => 0,
            );

            $row = ImageHelper::get_images_bg_rows($app_id, $whr);
            if ($row) {
                $db->update("images_bg", array("name" => $filename), $whr);
            } else {
                $whr["name"] = $filename;
                $db->insert("images_bg", $whr);
            }

            // Update background for all the tabs that use Default Theme including More Tab (more tab has tab_id = 0 in template_tab)
            if (count($default_theme_tab_ids) > 0) {
                foreach($default_theme_tab_ids as $tab_id) {
                    // When detail_type = 0 (TAB), detail_id keeps tab_id
                    // When detail_type = 51 (MORE_TAB), detail_id keeps 0
                    $whr = array(
                        "app_id"      => $app_id,
                        "device_type" => $v1_device,
                        "detail_id"   => $tab_id,
                        "detail_type" => ( $tab_id == 0 ) ? IMAGE_DETAIL_MORE_TAB : IMAGE_DETAIL_TAB
                    );

                    $row = ImageHelper::get_images_bg_rows($app_id, $whr);
                    if ($row) {
                        $db->update("images_bg", array("name" => $filename), $whr);
                    } else {
                        $whr["name"] = $filename;
                        $db->insert("images_bg", $whr);
                    }
                }
            }
        }

        AppsModel::update_app_image_timestamp($app_id);

        // Return $shortcuts
        $shortcuts = self::_get_shortcuts();
        $this->ajax_response(true, array(
            'bg_copied' => $bg_copied, // Nov 24, 2015 - Austin
            'flyup_seqs' => $flyup_seqs, // Nov 22, 2015 - Austin
            // array ( new101010120 => 40398, ... )  [Temporary ID => New Inserted ID]
            "new_shortcut_maps" => $new_shortcut_maps,
            "shortcuts" => $shortcuts,
            "msg" => $this->phrases['design_label_success_saved_design_setting']
        ));
    }


    /**
    * @author Austin
    * @since Jul 13, 2016
    *
    * When we remove one or more images from Shortcut modal / flyup, then we clear image name and Custom_Icon flag from this shortcut record in `home_sub_tabs`
    */
    protected function _fix_deleted_shortcuts($items)
    {
        if (empty($items)) {
            // nothing to fix
            return true;
        }

        BLoader::import('home_sub_tabs');        

        $db = DbModel::get_instance();
        
        $app_id = $this->get_app_id();

        $filenames = [];
        foreach($items as $item) {
            // Check if this file exists (because a new file might have been uploaded as same name just after removed old image)
            $v2_path = ImageHelper::get_image_path($app_id, 'shortcut', $item['id'], $item['filename']);
            if ( !SecureHelper::_file_exists($v2_path) ) {
                $filenames[] = $item['filename'];
            }
        }

        $dir_v1 = FileHelper::find_upload_dir($app_id, "cutom_icon");

        /* Shortcut IDs which have cleared filename just now */
        $sc_ids = HomeSubTabsModel::clear_filename($app_id, $filenames);

        foreach($sc_ids as $sc_id) {
            $v1_path = $dir_v1 . '/' . $sc_id . ".png";

            if (SecureHelper::_file_exists($v1_path)) {
                SecureHelper::_unlink($v1_path);
            };
        }
        
        return [
            'deleted_filenames' => $filenames,
            'fixed_shortcut_ids' => $sc_ids
        ];
    }

    /**
    * @author Austin
    * @since Jul 13, 2016
    *
    * ajax request handler
    */
    public function fix_deleted_shortcuts()
    {
        $items = get_var('deleted');
        $info = $this->_fix_deleted_shortcuts($items);

        $this->ajax_response(true,  ['info' => $info]);
    }

    /**
    * @author Austin
    * @since Aug 10, 2015
    */
    protected function _render_shortcut($app_id, $opts)
    {
        if (empty($app_id) || empty($opts["link_tab_id"])) {
            return false;
        }

        $defaults = [
            "app_id" => $app_id,
            "id" => 0,
            "link_tab_id" => 0,
            "is_hide" => 0,
            "is_active" => 1,
            "hide" => 0, // for messages tabs with value1=hide - Douglas
            "TabLabelText" => "",
            "TabLableTextColor" => "000000",
            "TabLableTextBackgroundColor" => "FFFFFF",
            "TabImageKey" => "",
            "TabImage" => false,
            "Custom_Icon" => 0,
            "seq" => 0,
            "icon" => []
        ];

        $item = array_merge($defaults, $opts);
        if (empty($item["id"])) {
             $item["id"] = "new".time();
        }

        if (!isset($opts["Custom_Icon"])) {
            if (empty($item["TabImage"])) {
                $item["icon"]["url"] = ImageHelper::get_no_image_url("shortcut");
            } else {
                if (substr($item["TabImageKey"], 0, 2) == "g_") {
                    $item["Custom_Icon"] = 0;
                    $item["icon"]["url"] = ImageHelper::get_library_image_url("shortcut", $item["TabImage"]);
                } else {
                    $item["Custom_Icon"] = 1;
                    $item["icon"]["url"] = ImageHelper::get_custom_image_url($app_id, "shortcut", array(
                        "filename" => $item["TabImage"],
                        "cms_version" => 2, /* Sep 29, 2015 - updated to 2 */
                        "nocache" => true
                    ));
                }
            }

            $filename = $item["icon"]["url"];
            $qpos = strpos($filename, "?");
            if ($qpos !== false) {
                $filename = substr($filename, 0, $qpos);
            }

            $item["icon"]["filename"] = pathinfo($filename, PATHINFO_BASENAME);
            $item["icon"]["id"] = ImageHelper::get_id($filename,  ($item["Custom_Icon"] == 1) ? "custom" : "lib");
           
        }
        $this->smarty->assign("shortcut", $item);
        $html = $this->smarty->fetch("pages/edit/design/shortcut_row.tpl");

        return [
            "id" => $item["id"],
            "item" => $item,
            "html" => $html
        ];
    }

    /**
    * Aug 10, 2015 - Austin. :  Add or update Shortcut (aka Home Sub Tab in v1)
    * This does not update DB and is used just for updating UI elements
    * Shortcuts are actually saved into DB only when you click SAVE button on the top bar
    */
    public function render_shortcut()
    {
        BLoader::import("app_tabs");

        $app_id = get_var("app_id", 0, "int");
        $link_tab_id = get_var("view_controller", 0, "int");

        if (empty($app_id) || empty($link_tab_id)) {
            $this->ajax_failed($this->phrases['design_label_fill_appid_tablabel_linktab']);
        }

        // shortcut_id can be String for new item, not only Integer
        $id = get_var("shortcut_id", "");
        $TabImageKey = get_var("shortcut");
        $TabImage = get_var("shortcut_filename");
        $is_hide = get_var("homescreen_only");
        $TabLabelText = stripslashes(get_var("shortcut_title"));
        $TabLableTextColor = get_var("subtab_text_color", "000000");
        $TabLableTextBackgroundColor = get_var("subtab_text_shadow", "FFFFFF");
        $seq = get_var("seq", 0, "int");

        // Get tab info from tab id of shortcut
        $tab = AppTabsModel::get_by_id($link_tab_id);
        if (empty($tab)) {
            $this->ajax_failed("Failed to get tab information");
        }
        $is_active = $tab['is_active'];
        $hide = $tab['value1'] == 'hide' ? 1 : 0;

        $data = self::_render_shortcut($app_id, compact(
            'id',
            'TabImageKey',
            'TabImage',
            'TabLabelText',
            'link_tab_id',
            'TabLableTextColor',
            'TabLableTextBackgroundColor',
            'is_hide',
            'is_active',
            'hide', // for messages tabs with value1=hide - Douglas
            'seq'
        ));

        if ($data == false) {
            $this->ajax_failed("Failed to render shortcut");
        }

        $this->ajax_response(true, array(
            'app_id' => $app_id,
            'item' => $data["item"],
            'html' => $data["html"]
        ));
    }

    public function load_slider_tab_detail()
    {
        BLoader::import("app_tabs");

        $app_id = $this->get_app_id();
        $tab_id = get_var("tab_id");
        $cat_id = get_var("cat_id");

        if (!$tab_id) {
            $this->ajax_failed($this->phrases['design_label_tab_id_empty']);
        }

        $db = DbModel::get_instance();
        $tab = AppTabsModel::get_by_id($tab_id);

        $details = array();
        $mode = 'item'; // Represents what you are returning to the ajax caller (items or categories)

        if ( in_array($tab["view_controller"], DbModel::$detail_table) ) {

            switch ($tab["view_controller"]) {
            case "EventsViewController":
            case "EventsManagerViewController":
                $v1 = $tab["value1"];
                if($v1 == "s") {
                    $orderby = "isactive DESC, seq";
                } else {
                    $orderby = "isactive DESC, event_date, from_hour * 60 + from_min";
                }

                $rows = $db->search("events", array("app_id" => $app_id, "tab_id" => $tab_id, "isactive" => 1), "all", $orderby);
                foreach($rows as $row) {
                    $details[] = array(
                        "id" => $row["id"],
                        "cat" => 0,
                        "depth" => 0,
                        "name" => stripslashes( $row["name"] ) . " (" . date("m/d/Y", $row["event_date"] - DatetimeHelper::get_server_timezone_offset()) . ")",
                    );
                }
                break;

            case "MenuViewController":
                if($cat_id > 0) {
                    $rows = $db->search("menu_items", array("menu_category_id" => $cat_id, "is_active" => 1), "all", "seq, name");
                    foreach($rows as $row) {
                        $details[] = array(
                            "id" => $row["id"],
                            "cat" => $cat_id,
                            "depth" => 0,
                            "name" => stripslashes( $row["name"] ) . " ($" . $row["price"] . ")",
                        );
                    }
                } else {
                    $mode = 'category';
                    $rows = $db->search("menu_categories", array("app_id" => $app_id, "tab_id" => $tab_id, "is_active" => 1), "all", "seq, name");
                    foreach($rows as $row) {
                        $details[] = array(
                            "id" => 0,
                            "cat" => $row["id"],
                            "depth" => 1,
                            "name" => stripslashes( $row["name"] ),
                        );
                    }
                }
                break;

            case "CouponsViewController":
            case "QRCouponViewController":
                if ($tab["view_controller"] == "CouponsViewController") {
                    $table = "coupons";
                } else {
                    $table = "qr_coupons";
                }
                $rows = $db->search($table, array("app_id" => $app_id, "tab_id" => $tab_id, "is_active" => 1), "all", "seq");
                foreach($rows as $row) {
                    $dur = "";
                    if($row["start_date"]) {
                        $dur .= date("m/d/Y", $row["start_date"] - DatetimeHelper::get_server_timezone_offset()) . " ~ ";
                    }
                    if($row["end_date"]) {
                        $dur .= date("m/d/Y", $row["end_date"] - DatetimeHelper::get_server_timezone_offset());
                    } else {
                        $dur .= "ongoing";
                    }

                    $details[] = array(
                        "id" => $row["id"],
                        "cat" => 0,
                        "depth" => 0,
                        "name" => stripslashes( $row["name"] ) . " ($dur)",
                    );
                }
                break;

            case "LoyaltyTabViewController":
                $rows = $db->search("loyalty", array("app_id" => $app_id, "tab_id" => $tab_id), "all", "seq");
                foreach($rows as $row) {
                    $details[] = array(
                        "id" => $row["id"],
                        "cat" => 0,
                        "depth" => 0,
                        "name" => stripslashes( $row["reward_text"] )
                    );
                }
                break;

            case "WebViewController":
            case "RestaurantBookingViewController":
            case "WuFooViewController":
            case "PDFViewController":
                $rows = $db->search("web_views", array("app_id" => $app_id, "tab_id" => $tab_id), "all", "seq, url");
                foreach($rows as $row) {
                    $details[] = array(
                        "id" => $row["id"],
                        "cat" => 0,
                        "depth" => 0,
                        "name" => stripslashes( $row["name"] )
                    );
                }
                break;

            case "InfoItemsViewController":
                $row = $db->search_fields("id", "info_categories", array("app_id" => $app_id, "tab_id" => $tab_id), "first", "seq, name");
                if ($row) {
                    $info_cat_id = $row["id"];
                    $rows = $db->search("info_items", array("info_category_id" => $info_cat_id), "all", "seq");
                    foreach($rows as $row) {
                        $details[] = array(
                            "id" => $row["id"],
                            "cat" => 0,
                            "depth" => 0,
                            "name" => stripslashes( $row["name"] )
                        );
                    }
                }
                break;

            case "InfoSectionViewController":
                if($cat_id > 0) {
                    $rows = $db->search("info_items", array("info_category_id" => $cat_id), "all", "seq");
                    foreach($rows as $row) {
                        $details[] = array(
                            "id" => $row["id"],
                            "cat" => $cat_id,
                            "depth" => 0,
                            "name" => stripslashes( $row["name"] )
                        );
                    }
                } else {
                    $mode = 'category';

                    $rows = $db->search("info_categories", array("app_id" => $app_id, "tab_id" => $tab_id, "is_active" => 1), "all", "seq, name");
                    foreach($rows as $row) {
                        $details[] = array(
                            "id" => 0,
                            "cat" => $row["id"],
                            "depth" => 1,
                            "name" => stripslashes( $row["name"] ),
                        );
                    }
                }
                break;

            case "MusicViewController":
                $whr = array(
                    "app_id" => $app_id,
                    "tab_id" => $tab_id,
                    "is_active" => 1,
                    "track" => array("%mzstatic.com%", "NOT (%1 LIKE '%2')")
                );

                $rows = $db->search("music_detail", $whr, "all", "seq");
                foreach($rows as $row) {
                    $details[] = array(
                        "id" => $row["id"],
                        "cat" => 0,
                        "depth" => 0,
                        "name" => stripslashes( $row["title"] )
                    );
                }
                break;

            case "AroundUsViewController":
                $whr = array(
                    "app_id" => $app_id,
                    "tab_id" => $tab_id
                );

                $rows = $db->search("pois", $whr, "all", "seq DESC, color");
                foreach($rows as $row) {
                    $details[] = array(
                        "id" => $row["id"],
                        "cat" => 0,
                        "depth" => 0,
                        "name" => stripslashes( $row["name"] )
                    );
                }
                break;

            case "RealEstateViewController":
                $whr = array(
                    "app_id" => $app_id,
                    "tab_id" => $tab_id
                );

                $rows = $db->search("realestate_main", $whr, "all", "seq, rm_id");
                foreach($rows as $row) {
                    $address = array();
                    if ( !empty($row['address1']) ) {
                        $address[] = $row['address1'];
                    }
                    if ( !empty($row['address2']) ) {
                        $address[] = $row['address2'];
                    }
                    if ( !empty($row['city']) ) {
                        $address[] = $row['city'];
                    }
                    if ( !empty($row['state']) ) {
                        $address[] = $row['state'];
                    }
                    if ( !empty($row['zip']) ) {
                        $address[] = $row['zip'];
                    }
                    $address = implode(", ", $address);

                    $details[] = array(
                        "id" => $row["rm_id"],
                        "cat" => 0,
                        "depth" => 0,
                        "name" => stripslashes( $address ),
                    );
                }
                break;

            default:
            }
        }

        /**
        * $details contains the list of Categories or Items of a category
        */
        $this->ajax_response(true, array(
            'mode' => $mode,
            'details' => $details
        ));
    }


    /**
    * Load industry for tab icons (Modern | Traditional)
    */
    public function load_tab_icon_industry()
    {
        $industry_id = get_var("industry_id");
        $items = ImageHelper::get_tab_icon_industry($industry_id);

        $this->ajax_response(true, [
            'items' => $items
        ]);
    }

    /**
    * Load industry for shortcuts
    */
    public function load_shortcut_industry()
    {
        $industry_id = get_var("industry_id");
        $items = ImageHelper::get_shortcut_industry($industry_id);

        $this->ajax_response(true, [
            'items' => $items
        ]);
    }

    /*
    *   Should copy i4 bg to the i5 bg section.
    *   
    */
    public function uploadI4bg() {

        $app_id = get_var("app_id");

        $app = $this->get_app();
        if ($app["i4_bg_cp_status"] == 0) {
            $status = ImageHelper::copy_i4bg_to_i5($app_id);
        }

        AppsModel::set_i4_bg_cp_status($app_id, 1);
        $this->ajax_response(true, [
            "data" => [
                "status" => $status
            ]
        ]);
    }

    /* Store Tutorial Visit Data in AppMeta Model */
    public function store_app_meta_tutorial() {
        
        BLoader::import('app_meta');

        $app_id = $this->get_app_id();
        $visit = array();

        $visit = json_decode(AppMetaModel::load_field($app_id, "visit"), true);
        
        if(!isset($visit['design_tutorial'])) {
            $visit['design_tutorial'] = 1;
        }
        else {
            $visit['design_tutorial'] = intval($visit['design_tutorial']) + 1;
        }

        $visit = json_encode($visit);
        AppMetaModel::save_field($app_id, "visit", $visit);
        
        $this->ajax_response(true);
    }

    /* Check recent app from May 5, 2016 */
    protected function checkRecentApp($date) {
        
        $newapp_date = mktime(0, 0, 0, 5, 5, 2016);

        if($date >= $newapp_date) {
            return true;
        }

        return false;
    }

    public function update_applause_status() {

        $app_id = $this->get_app_id();
        $db = DbModel::get_instance();
               
        return $db->update("apps",
            array(
                'applause_hide' => 1
            ),
            array(
               'id' => $app_id
            )
        );       
    }
}