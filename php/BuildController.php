<?php
/**
 * BuildController.php
 *
 * This class supports the actions for build page.
 *
 * @author Austin L <auslee986@gmail.com>
 * @version 1.0
 */

class BuildController extends Controller {

	protected $default_sections = array(
		'content' => array(
			'has' => true,
			'label' => 'build_label_content',
		),
		'model' => array(
			'has' => true,
			'label' => 'build_label_model',
		),
		'comments' => array(
			'has' => false,
			'label' => 'build_label_comments',
		),
	);

	protected $custom_opts_tabs = array(
		'fanWallManagerView' => array(
					'comments' => array(
						'has' => false,
						'label' => 'build_label_comments',
					),
				),
		'eventsManagerView' => array(
					'comments' => array(
						'has' => true,
						'label' => 'build_label_comments',
					),
				),
		'infoDetailView' => array(
					'comments' => array(
						'has' => true,
						'label' => 'build_label_comments',
					),
				),
		'infoItemsView' => array(
					'comments' => array(
						'has' => true,
						'label' => 'build_label_comments',
					),
				),
		'infoSectionView' => array(
					'comments' => array(
						'has' => true,
						'label' => 'build_label_comments',
					),
				),
		'aroundUsView' => array(
					'comments' => array(
						'has' => true,
						'label' => 'build_label_comments',
					),
				),
		'locationView' => array(
					'comments' => array(
						'has' => true,
						'label' => 'build_label_comments',
					),
				),
		'couponsView' => array(
					'comments' => array(
						'has' => true,
						'label' => 'build_label_activity',
					),
				),
		'qRCouponView' => array(
					'comments' => array(
						'has' => true,
						'label' => 'build_label_activity',
					),
				),
		'loyaltyTabView' => array(
					'comments' => array(
						'has' => true,
						'label' => 'build_label_activity',
					),
				),
		'eventsManagerView' => array(
					'comments' => array(
						'has' => true,
						'label' => 'build_label_comments',
					),
					'attend' => array(
						'has' => true,
						'label' => 'build_label_attend',
					),
					'images' => array(
						'has' => true,
						'label' => 'build_label_images',
					),

				),
		'carFinderView' => array(
					'model' => array(
						'has' => false,
						'label' => 'build_label_model',
					),
				),
		'instructionView' => array(
					'model' => array(
						'has' => false,
						'label' => 'build_label_model',
					),
				),
		'wuFooView' => array(
					'model' => array(
						'has' => false,
						'label' => 'build_label_model',
					),
				),
	);

	protected $tabControllerOpts = false;

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
			'build', // this is only for current page
			'design', // Used for Custom Design
		);

        $opts['phrases_js'] = [
        	'global',
        	'flyup',
        	'publish',
        	'build',
        ];

		parent::__construct($opts);

		$this->rules = array(
			'*' => 'auth.client_loggedin'
		);

		$this->prepareTabControllerOpts();

		// Init dashboard.
		$this->init_dashboard('edit', 'edit_build');
	}

	public function prepareTabControllerOpts () {

		$customOpts = false;

		foreach($this->default_sections AS $kv => &$vv) {
			$vv['label'] = $this->phrases[$vv['label']];
		}
		unset($vv);
		foreach($this->custom_opts_tabs AS $ck => &$cv) {
			foreach($cv AS $kv => &$vv) {
				$vv['label'] = $this->phrases[$vv['label']];
			}
		}
		unset($cv);
		unset($vv);

		$this->tabControllerOpts['default'] = $this->default_sections;
		foreach($this->custom_opts_tabs AS $kv => $vv) {
			$customOpts[$kv] = array_merge($this->default_sections, $vv);
		}
		$this->tabControllerOpts['custom'] = $customOpts;
	}

	/**
	 * Show build page.
	 * @return html
	 */
	public function index()
	{
		BLoader::import('app_tabs, template_app, view_controllers, apps, images_bg');
		BLoader::import_helper('app_tabs, svg, image');

		$app_id = $this->get_app_id();
		$app = $this->get_app();

		$xtr = ImageHelper::get_xtr($app_id);
		$app_xtrs = $xtr["xtr"];

		// 0: traditional, 1: slider list, 2: slider tiles
		$home_layout = $app_xtrs["home_layout"];

		// Get the template detail info.
		$template_detail = TemplateAppModel::get_app_detail_by_app_id($app_id);

		// 0: left, 1: top, 2: right, 3: bottom
		$btn_layout = $template_detail["btn_layout"];

		// Get the all app tabs for this user with template data.
		$app_tabs = AppTabsModel::get_app_tabs($app_id);

		$app_tabs = AppTabsHelper::prepare_tabs($app_id, $app_tabs, $template_detail);

		if (empty($app_tabs)) {
			$app_tabs = false;
		}

		$tab_icon_color = $template_detail['tab_icon_color'];
		if (empty($tab_icon_color)) {
			$tab_icon_color = SvgHelper::colorname2hex($template_detail["tab_icon"]);
		}

		// Get view controllers.
		$view_controllers = ViewControllersModel::get_all_with_link();

		// Background Library images
		$bg_lib = ImageHelper::get_library_images($app_id, "bg");

		if ($home_layout == 0) {
			// Traditional layout (Bottom | Top | Edges [left | right])
			$has_more_tab = $template_detail["with_moreview"] ? 1 : 0;

			if (is_partner()) {
				if (in_array('ebcd', $this->reseller_theme_v2['hidden_sections'])) {
					$has_more_tab = 0;
				}
			}
		} else {
			// Sliding (Tile | List)
			$has_more_tab = 0;
		}

		list($nav_type, $nav_type_main) = TemplateAppModel::get_nav_types($home_layout, $btn_layout);

		$more_tab = AppTabsHelper::prepare_more_tab($app_id, $template_detail);

		$tab_icon_industry_options 		= ImageHelper::get_industry_names("tab_icon");
		$thumb_industry_options 		= ImageHelper::get_industry_names("thumb");
		$header_industry_options 		= ImageHelper::get_industry_names("header");
		$tab_header_industry_options 	= ImageHelper::get_industry_names("tab_header");
        $tab_button_industry_options 	= ImageHelper::get_industry_names("tab_button");
        $location_industry_options 		= Imagehelper::get_industry_names("location");
        // $merchandise_cat_industry_options = ImageHelper::get_industry_names("merchandise_cat");
        // $products_industry_options = ImageHelper::get_industry_names("product");

		// Check i4 bg exist in i4 section, should consider for old app.
		$app_date = $app["date_joined"];
		if (BizHelper::is_recentapp($app_id, $app_date)) {
			AppsModel::set_i4_bg_cp_status($app_id, 1);
			$check_i4_assigned = false;
		} else {
			$check_i4_assigned = ImageHelper::check_mobile_bgExistence($app_id);    
		}

		$tab_icon = ImageHelper::get_tab_icons($app_id);
		$thumb 	  = ImageHelper::get_image_set($app_id, 'thumb');
		$form_bg  = ImageHelper::get_image_set($app_id, 'form_bg');
		$product  = ImageHelper::get_image_set($app_id, 'product');
		$offer_modal_gauge  = ImageHelper::get_tab_icons($app_id);

		$is_release_flyup_freeze = ArrayHelper::is_release_flyup_freeze($this->app["code"]);

        if (!$is_release_flyup_freeze) {
            $tab_icon["no_image"]["filename"] = "no_button.png";
            $tab_icon["no_image"]["url"] = "/images/theme_editor/no_button.png";

			$thumb["no_image"]["filename"] = "no_button.png";
            $thumb["no_image"]["url"] = "/images/theme_editor/no_button.png";

            $product["no_image"]["url"] = "/images/theme_editor/no_button.png";
            $offer_modal_gauge['no_image']['url'] = "/images/theme_editor/no_button.png";
        } else {
        	$offer_modal_gauge['no_image']['url'] = ImageHelper::get_no_image_url("offer_modal_gauge");
        }

		$g_vars = [
			'bg' => [
				"no_image" => [
					"phone" => ImageHelper::get_no_image("bg", ["device" => "phone"]),
					"tablet" => ImageHelper::get_no_image("bg", ["device" => "tablet"]),
				],
				"lib" => $bg_lib["industry_bg_images"],
				"custom" => [
					"phone"  => ImageHelper::get_custom_images($app_id, "bg", array("device" => "phone")),
					"tablet" => ImageHelper::get_custom_images($app_id, "bg", array("device" => "tablet")),
				]
			],

			// List of pairs (industry_id, industry_name)
			// e.g:  19 => Artist Gallery
			'bg_industries' => $bg_lib["industry_options"],

			'dimensions' => ImageHelper::get_all_dimensions(),

			'tab_header' => [
				"phone" => [
					"no_image" => ImageHelper::get_no_image("tab_header", ["device" => "phone"]),
					"custom"  => ImageHelper::get_custom_images($app_id, "tab_header", array("device" => "phone")),
					"lib"  => ImageHelper::get_library_images($app_id, "tab_header", array("device" => "phone"))
				],
				"tablet" => [
					"no_image" => ImageHelper::get_no_image("tab_header", ["device" => "tablet"]),
					"custom"  => ImageHelper::get_custom_images($app_id, "tab_header", array("device" => "tablet")),
					"lib"  => ImageHelper::get_library_images($app_id, "tab_header", array("device" => "tablet")),
				]
			],

			/* Nov 9, 2015 - Austin */
			'tab_icon_industries' => $tab_icon_industry_options,
			'thumb_industry_options' => $thumb_industry_options,
			'header_industry_options' => $header_industry_options,
			'tab_button_industry_options' => $tab_button_industry_options,
			'tab_header_industry_options' => $tab_header_industry_options,
			'location_industry_options' => $location_industry_options,
			// 'merchandise_cat_industry_options' => $merchandise_cat_industry_options,   /* CV-2787  */
			// 'products_industry_options' => $products_industry_options,

			'tab_icon' 			=> $tab_icon,
			'thumb' 			=> $thumb,
			'form_bg' 			=> $form_bg,
			'ordering_menu' 	=> ImageHelper::get_image_set($app_id, 'ordering_menu'),
			'merchandise_cat' 	=> ImageHelper::get_image_set($app_id, 'merchandise_cat'),
			'product' 			=> $product,
			'offer_modal_gauge' => $offer_modal_gauge,

			'has_more_tab' 		=> $has_more_tab,
			'more_tab' 			=> $more_tab
		];

		$this->assign('app_code', $this->app['code']);
		$this->assign("bg_industry_options", $bg_lib["industry_options"]);
		$this->assign("thumb_industry_options", $thumb_industry_options);
		$this->assign("header_industry_options", $header_industry_options);
		$this->assign("tab_button_industry_options", $tab_button_industry_options);
		$this->assign("tab_header_industry_options", $tab_header_industry_options);

        $g_vars = str_replace('bizapps', 'root_path', json_encode($g_vars));
        $encoded_g_vars = addslashes($g_vars);
        $this->assign("g_vars",  $encoded_g_vars);

		$this->assign_bulk(compact('template_detail','check_i4_assigned' , 'view_controllers', 'app_tabs', 'nav_type_main', 'nav_type', 'more_tab', 'has_more_tab', 'tab_icon_industry_options'));

		BLoader::import('app_meta');
		$visit = array();
		$visit = json_decode(AppMetaModel::load_field($app_id, "visit"), true);
		if(!isset($visit['build_tutorial']) || $visit['build_tutorial'] == '0') {
			$this->assign('first_visit', 1);
		}
		else {
			$this->assign('first_visit', 0);
		}

		// SVG url
		$hover = BizHelper::get_color('hover');

		$svgs = [];
		$svgs['search'] = [
			'active' => ImageHelper::get_svg_url('whitelabel', 'search', ColorHelper::darken($hover, 20)),
			'inactive' => ImageHelper::get_svg_url('whitelabel', 'search', 'adadad'),
			'size' => 16
		];

		$this->assign('svgs', $svgs);
	}

	/**
	 * Load data, in need to load tabs and just do it here, not on index action.
	 * NOTE: ajax call
	 * @return string The json encoded object string.
	 */
	public function load()
	{
		BLoader::import('appTabs, templateApp, viewControllers');
		BLoader::import_helper('appTabs, svg, array');

		$app_id = $this->get_app_id();

		// Get the template detail info.
		$template_detail = TemplateAppModel::get_app_detail_by_app_id($app_id);

		// Get the all tab information (except More tab)
		// More tab information is fetched in self::index()
		$app_tabs = AppTabsModel::get_app_tabs($app_id);
		$app_tabs = AppTabsHelper::prepare_tabs($app_id, $app_tabs, $template_detail, true);

		// Get view controllers.
		$excl_vc = array('OrderingViewController', 'MerchandiseViewController');
		if (ArrayHelper::is_release_settings_membership($this->get_app_code())) {
			$excl_vc[] = 'MembershipManageController';
		}
		$view_controllers = ViewControllersModel::get_all_with_link($excl_vc);

		$industry_maps = ImageHelper::get_industry_maps([
			'tab_icon', 'bg', 'thumb', 'global_header', 'tab_button', 'tab_header', 'form_bg', 'location', 'product', 'merchandise_cat'
		]);

		$this->ajax_response(true, array(
			'tabs' => !empty($app_tabs['tabs']) ? $app_tabs['tabs'] : false,
			'view_controllers' => $view_controllers,
			'tab_opts' => $this->tabControllerOpts,
			//'icons' => $app_tabs["tabicons"]
			'industry_maps' => $industry_maps
		));
	}

	public function load_view_controlllers()
	{
		BLoader::import('appTabs, templateApp, viewControllers');
		BLoader::import_helper('appTabs, svg');

		// Get view controllers.
		$view_controllers = ViewControllersModel::get_all_with_link(array('OrderingViewController', 'MerchandiseViewController'));

		$this->ajax_response(true, array(
			'view_controllers' => $view_controllers,
		));
	}

	/**
	 * Save
	 * NOTE: ajax call
	 * @return string The json encoded object string.
	 */
	public function save()
	{
		$this->init_tab();
		$this->ajax_response(true, array(
			'msg' => $this->phrases['build_label_success_save_tab_data'],
			'html' => false,
			'data' => array(
				'tabs' => $this->get_tab_changes()
			)
		));
	}

	public function create_tab()
	{
		BLoader::import('apps, app_tabs, template_app');
		BLoader::import_helper('app_tabs, request');

		$this->app_id = $this->get_app_id();
		$data = RequestHelper::get_safe_data($_POST);

		$tab = $data["tab"];

		$new_tab = AppTabsHelper::add_tab($this->app_id, array(
			'view_controller' => $tab['viewController'],
			'tab_icon' => '',
			'tab_icon_new' => $tab['iconKey'],
			'tab_label' => $tab['tabLabel'],
			'is_active' => $tab['active'],
			'seq' => $tab['seq']
		), $this->phrases);

		$success = false;
		if ($new_tab['error_code'] == ERROR_INSERT) {
			$return_data = array(
				'msg' => $this->phrases['build_label_failed_create_new_tab'],
				'data' => false,
			);
		} else if ($new_tab['error_code'] == ERROR_RETRIEVE) {
			$return_data = array(
				'msg' => $this->phrases['build_label_failed_find_newly_created_tab'],
				'data' => false,
			);
		} else if ($new_tab['error_code'] == ERROR_DUPLICATE_TAB) {
			$return_data = array(
				'msg' => str_replace('{desc}', $tab['desc'], $this->phrases['build_label_not_allowed_add_two_or_more_tabs']),
				'data' => false,
			);
		} else {
			$success = true;
			$return_data = array(
				// 'msg' => 'Success to create new tab - ' . $tab['tabLabel'] . '(' . $tab['desc'] . ')',
				'msg' => str_replace(
					array('{label}', '{desc}'),
					array($tab['tabLabel'], $tab['desc']),
					$this->phrases['build_label_success_create_new_tab']
				),
				'data' => $new_tab['data'],
			);

		}

		$this->ajax_response($success, $return_data);
	}

	public function store_app_meta_tutorial() {
		$app_id = $this->get_app_id();
		BLoader::import('app_meta');
		$visit = array();
		$visit = json_decode(AppMetaModel::load_field($app_id, "visit"), true);
		if(!isset($visit['build_tutorial'])) {
			$visit['build_tutorial'] = 1;
		}
		else {
			$visit['build_tutorial'] = intval($visit['build_tutorial']) + 1;
		}
		$visit = json_encode($visit);
		AppMetaModel::save_field($app_id, "visit", $visit);
		
		$this->ajax_response(true);
	}
}
