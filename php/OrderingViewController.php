<?php
/**
 * OrderingViewController.php
 *
 * This class supports the controller for music tab.
 *
 * @author Austin L <auslee986@gmail.com>
 * @version 1.0
 */



BLoader::import('apps, AppTabs, Timezone, AppPrinter, MstOptions, MstStoreinfo, OrdersEmail, Restaurant, RestaurantItem, RestaurantMenu, RestaurantItemSize, RestaurantTime, RestaurantItemOptions, RestaurantItemOptionGroup, Tax, TabLocations, TabLocationTime, Currency, TemplateApp');
BLoader::import_helper('appTabs, request, image, array, google, spreedly, Location');


class OrderingViewController extends Controller {


    public $oServices = array(
        'mycheck' => array("MyCheck", "http://www.mycheck.io/"),
        // 'onlineordering' => "OnlineOrdering",
        'imenu360' => array('iMenu360', "http://imenu360.com/"),
        'olo' => array("olo", "http://www.olo.com/"),
        'eat24' => array("Eat24", "http://eat24.com/"),
        'grubhub' => array("Grubhub", "https://www.grubhub.com/"),
        'seamless' => array("Seamless", "https://www.seamless.com/"),
        'onosys' => array("Onosys", "https://www.onosys.com/"),
    );

    public $oServicesV = array();

    /**
	 * Constructor.
	 */
	public function __construct($opts)
	{
        parent::__construct($opts);

        $this->rules = array(
            '*' => 'auth.client_loggedin'
        );

        $this->init_tab();

        foreach ($this->oServices as $k => $v) {
            $this->oServicesV[$v[0]] = $k;
        }
	}

    public function is_test_app() {
        return ArrayHelper::is_testapp($this->app['code']);
    }
    
    /**
     * Get content of tab.
     * @return html
     */
    public function content() {

        //Check is test app
        $app_id = $this->app_id;
        $app = AppsModel::get_app($app_id);
        $admin_user_id = $app['admin_user_id'];
        BLoader::import('AdminUsers');
        $admin_user = AdminUsersModel::find_by_id($admin_user_id);
        $is_test_partner = 0;
        if ( $admin_user['partner_code'] == 'partnerwebx1' ) {
            $is_test_partner = 1;
        }
        $is_test_app = $this->is_test_app() || $is_test_partner;


        $this->assign('is_test_app', $is_test_app);
        
        $is_release_cedar = ArrayHelper::is_release_cedar($this->app['code'])?'1':'0';
        $this->assign('is_cedar', $is_release_cedar);

        $is_new_ordering = ($this->tab['sub_version'] == 2);
        $this->assign('is_new', $is_new_ordering?'1':'0');

        $imported_count = 0;

        // ------------------------------------------
        // Get Timezone
        // ------------------------------------------
        $default_timezone = intval($this->app['timezone']);
        if ($default_timezone == 0) $default_timezone = 10; // PDT Timezone

        TimezoneModel::set_strip_state(false);
        $timezone_rows = TimezoneModel::get_timezones();
        TimezoneModel::set_strip_state(true);

        $this->assign('timezones', $timezone_rows, true);
        $this->assign('default_timezone', $default_timezone);

        $timezones = array();
        foreach ($timezone_rows AS $tz) {
            $timezones[$tz['id']] = array(
                $tz['timezone_value'],
                $tz['timezone_name'],
            );
        }

        // ------------------------------------------
        // Get Currency List
        // ------------------------------------------
        $currency_list = CurrencyModel::get_currencies();
        $this->assign('all_currency_list', $currency_list);
        
        $braintree_currencies = CurrencyModel::get_currencies( array('braintree' => 1) );
        $this->assign('braintree_currency_list', $braintree_currencies);   // Add byte
        
        $paypal_currencies = CurrencyModel::get_currencies( array('paypal' => 1) );
        $this->assign('paypal_currency_list', $paypal_currencies);   // Add byte
        
        $payu_currencies = CurrencyModel::get_currencies( array('payu' => 1) );
        $this->assign('payu_currency_list', $payu_currencies);
        $payu_latam_currencies = CurrencyModel::get_currencies( array('payu_latam' => 1) );
        $this->assign('payu_latam_currency_list', $payu_latam_currencies);

        // ---------------------------------------------------------------
        // ---------------------------------------------------------------


        // ------------------------------------------
        // Get store infoset
        // ------------------------------------------
        $opt_rows = MstStoreinfoModel::get_stores($this->app_id, $this->tab_id);

        $opts = array();
        $opt_cont = '';
        $nav_cont = '';

        // prepare opts array
        foreach ($this->oServices as $k => $v) {
            $opts[$k] = '';
        }

        // fill opts array by record rows from mst_info table
        $current_store = 'custom';
        foreach ($opt_rows as $row) {
            $keyv = $this->oServicesV[$row['store_name']];
            if ($keyv) {
                $opts[$keyv] = $row['cart_url'];
                if ($row['enable_store'] == '1') $current_store = $keyv;
            }
        }

        // render tpls for opts
        foreach ($opts AS $k => $v) {

            $this->assign("opt_key", $k);
            $this->assign("opt_label", $this->oServices[$k][0]);
            $this->assign("opt_url", $this->oServices[$k][1]);
            $this->assign("opt_value", $v, true);
            $opt_cont .= $this->render_only_template('tabs.orderingview.content-opt');
            $nav_cont .= $this->render_only_template('tabs.orderingview.content-nav');

            // clear assign
            $this->smarty->clearAssign(array("opt_key", "opt_value"));
        }

        // assign rendered opt html
        $this->assign('opt_content', $opt_cont);
        $this->assign('nav_content', $nav_cont);
        $this->assign('active_store', $current_store);
        // ---------------------------------------------------------------
        // ---------------------------------------------------------------


        // ------------------------------------------------------
        // Get tab restaurant info, locations, open times
        // ------------------------------------------------------

        // Get locations
        RestaurantModel::set_strip_state(false);
        $main_info = RestaurantModel::get_restaurant_info($this->app_id, $this->tab_id);
        RestaurantModel::set_strip_state(true);

        TabLocationsModel::set_strip_state(false);
        $locs = TabLocationsModel::get_by_tab($this->tab_id);
        TabLocationsModel::set_strip_state(true);
        
        if ( !$main_info && !$locs ) {
            // Try to import location info from the main section...
            $imported_count = TabLocationsModel::import_locations($this->app_id, $this->tab_id);
            if ($imported_count > 0) {

                TabLocationsModel::set_strip_state(false);
                $locs = TabLocationsModel::get_by_tab($this->tab_id);
                TabLocationsModel::set_strip_state(true);
            }
        }

        // Do some type fixing
        for ($i = 0; $i < count($locs); $i++) {
            $locs[$i]['dstOffset'] = doubleval($locs[$i]['dstOffset']);
            $locs[$i]['use_global_timezone'] = '0';
            if ($locs[$i]['timezone'] == -1) {
                $locs[$i]['timezone'] = $default_timezone . '';
                $locs[$i]['use_global_timezone'] = '1';
            }
        }
        
        $main_info['all_currency'] = $main_info['currency'];
        
        // Checking the braintree currencies
        $is_braintree_currency = 0;
        for ( $i = 0 ; $i < count( $braintree_currencies ) ; $i++ ) {
            if ( $braintree_currencies[$i]['currency_code'] == $main_info['currency'] )
                $is_braintree_currency = 1;
        }
        $main_info['braintree_currency'] = 'USD';
        if ( $is_braintree_currency == 1 ) {
            $main_info['braintree_currency'] = $main_info['currency'];
        }
        
        // Checking the paypal currencies
        $is_paypal_currency = 0;
        for ( $i = 0 ; $i < count( $paypal_currencies ) ; $i++ ) {
            if ( $paypal_currencies[$i]['currency_code'] == $main_info['currency'] )
                $is_paypal_currency = 1;
        }
        $main_info['paypal_currency'] = 'USD';
        if ( $is_paypal_currency == 1 ) {
            $main_info['paypal_currency'] = $main_info['currency'];
        } 
        
        // Checking the payu_india currencies
        $is_payu_currency = 0;
        for ( $i = 0 ; $i < count( $payu_currencies ) ; $i++ ) {
            if ( $payu_currencies[$i]['currency_code'] == $main_info['currency'] )
                $is_payu_currency = 1;
        }
        $main_info['payu_currency'] = 'USD';
        if ( $is_payu_currency == 1 ) {
            $main_info['payu_currency'] = $main_info['currency'];
        }
        if ( !$main_info['currency'] ) {
            $main_info['currency'] = 'USD';
        }
        
        // Checking the payu_latam currencies
        $is_payu_latam_currency = 0;
        for ( $i = 0 ; $i < count( $payu_latam_currencies ) ; $i++ ) {
            if ( $payu_latam_currencies[$i]['currency_code'] == $main_info['currency'] )
                $is_payu_latam_currency = 1;
        }
        $main_info['payu_latam_currency'] = 'USD';
        if ( $is_payu_latam_currency == 1 ) {
            $main_info['payu_latam_currency'] = $main_info['currency'];
        }
        if ( !$main_info['currency'] ) {
            $main_info['currency'] = 'USD';
        }
        
        if ( !$main_info ) {
            $main_info = array(
                "id" => "",
                "restaurant_name" => "",
                "brief_desc" => "",
                "description" => "",
                "logo_url" => "",
                "currency" => "USD",
                "takeout" => "1",  // Should be active as default
                "takeout_days" => "0",
                "dinein" => "1",
                "is_delivery" => "1", // Should be active as default
                "is_delivery_address_validation" => "1",
                "delivery_days" => "0",
                "delivery_fee" => "0",
                "delivery_fee_taxable" => "1",
                "delivery_minimum" => "10",
                "free_delivery_amount" => "0",
                "delivery_radius" => "10",
                "delivery_radius_type" => "0",
                "convenience_fee" => "0",
                "convenience_fee_taxable" => "1",
                // Minimum lead time is 5 minutes
                "lead_time" => "30",
                "cuisine_type" => "",
                "admin_email" => "",
                "ref_tk" => "",
                "button_label" => $this->phrases['build_label_order_now'],
                // "time_format" => "0"
            );
        }

        if ((intval($main_info["id"]) > 0) && ($main_info["ref_tk"] == "")) {
            $main_info["ref_tk"] = urlencode(RestaurantModel::update_retaurant_token(intval($main_info["id"])));
        }
        $main_info["preview_url"] = '/mobile/?appcode=' . $this->app['code'] . '&controller=FoodOrderingViewController&tab_id=' . $this->tab_id . '&webview=1';
        $main_info["home_url"] = get_site_url();
        
        $this->assign('main', $main_info, true);


        // Get Open Times
        $loc_ids = array();
        $loc_index = array();
        $loc_all4item = array();
        $loc_ind = 0;
        foreach ($locs AS $loc) {
            $loc_ids[] = $loc['id'];
            $loc_index[$loc['id']] = "" . $loc_ind;
            $loc_all4item[] = "" . $loc_ind;
            $loc_ind ++;
        }
        $open_times = TabLocationTimeModel::get_tab_location_times_set( $loc_ids );

        for ($i = 0; $i < count($locs); $i++) {
            $locs[$i]['ots'] = $open_times[$locs[$i]['id']];
            $locs[$i]['seq'] = count($locs) - $i;
            $locs[$i]['ref_id'] = $i;

            // Now lets remove unneeded fields
            unset($locs[$i]['tab_id']);
        }

        $this->assign('counts', count($locs));
        // ---------------------------------------------------------------
        // ---------------------------------------------------------------

        // ---------------------------------------------------------------
        // Load app locs
        // ---------------------------------------------------------------
        $locations = $this->get_locs();
        $this->assign('locs', $locations[0], true);

        /* sync from app loc to location */
        for ($i = 0; $i < count($locs); $i++) {
            $locs[$i]['dstOffset'] = doubleval($locs[$i]['dstOffset']);
            if (intval($locs[$i]['app_location_id']) > 0) {
                if (isset($locations[2][$locs[$i]['app_location_id']])) {
                    $app_loc = $locations[2][$locs[$i]['app_location_id']];
                    $locs[$i]['address_top_row']    = $app_loc['address_top_row'];
                    $locs[$i]['address_bottom_row'] = $app_loc['address_bottom_row'];
                    $locs[$i]['address_1']          = $app_loc['address_1'];
                    $locs[$i]['address_2']          = $app_loc['address_2'];
                    $locs[$i]['formatted_address']  = $app_loc['formatted_address'];
                    $locs[$i]['city']               = $app_loc['city'];
                    $locs[$i]['state']              = $app_loc['state'];
                    $locs[$i]['country']            = $app_loc['country'];
                    $locs[$i]['zip']                = $app_loc['zip'];
                    $locs[$i]['latitude']           = $app_loc['latitude'];
                    $locs[$i]['longitude']          = $app_loc['longitude'];
                } else {
                    $locs[$i]['app_location_id'] = '0';
                }
            }
        }
        
        // Get location depending to the user's ip address
        $ip_address = $_SERVER['REMOTE_ADDR'];

        $is_location_us = 0;
        
        $ip_location = LocationHelper::get_address_array_with( array($ip_address) );
        
        if ( $ip_location->{$ip_address}->country_code == "US" ) {
            $is_location_us = 1;
        }
    
        $this->assign('is_location_us', $is_location_us);
        // ---------------------------------------------------------------
        // ---------------------------------------------------------------

        // ---------------------------------------------------------------
        // Load Tax List
        // ---------------------------------------------------------------
        TaxModel::set_strip_state(false);
        $tax_rows = TaxModel::get_tax_by_tab_id($this->tab_id);
        TaxModel::set_strip_state(true);

        $tax = array();
        foreach ($tax_rows as $t) {
            $tax[] = array(
                'id' => $t['id'],
                'tax_name' => $t['tax_name'],
                'tax_rate' => $t['tax_rate'],
                'flat_amount' => $t['flat_amount'],
                'tax_type' => $t['tax_type'],
            );
        }
        // ---------------------------------------------------------------
        // ---------------------------------------------------------------


        // ------------------------------------------------------
        // Get tab restaurant info, locations, open times
        // ------------------------------------------------------
        $braintree = array(
            'id' => '',
            'public_key' => '',
            'private_key' => '',
            'enabled' => '0',
        );
        
        $paypal = array(
            'api_username' => '',
            'api_password' => '',
            'signature' => ''
        );
        
        $payu = array(
            'merchantkey' => '',
            'salt' => ''
        );
        $payu_latam = array(
            'merchant_id' => '',
            'account_id' => '',
            'api_login' => '',
            'api_key' => ''
        );

        $cash = array(
            'enabled' => '0',
        );


        $pm_rows = MstOptionsModel::get_payment_gateways($this->tab_id);
        $gateway_method = 0;
        foreach ($pm_rows AS $row) {
            if ($row['gateway_type'] == '5') {
                $braintree = array(
                    'id' => $row['gateway_key'],
                    'public_key' => $row['gateway_password'],
                    'private_key' => $row['gateway_signature'],
                    'enabled' => $row['is_main'],
                );
                if( $row['is_main'] == 1 )
                    $gateway_method = 5;
            } else if ($row['gateway_type'] == '6') {
                $paypal = array(
                    'api_username' => $row['gateway_key'],
                    'api_password' => $row['gateway_password'],
                    'signature' => $row ['gateway_signature'],
                    'enabled' => $row['is_main']
                );
                if( $row['is_main'] == 1 )
                    $gateway_method = 6;
            } else if ($row['gateway_type'] == '7') {
                $payu = array(
                    'merchantkey' => $row['gateway_key'],
                    'salt' => $row['gateway_password'],
                    'enabled' => $row['is_main']
                );
                if( $row['is_main'] == 1 )
                    $gateway_method = 7;
            } else if ($row['gateway_type'] == '8') {
                $payu_latam = array(
                    'merchant_id' => $row['gateway_appid'],
                    'account_id' => $row['gateway_key'],
                    'api_login' => $row['gateway_password'],
                    'api_key' => $row['gateway_signature'],
                    'enabled' => $row['is_main']
                );
                if( $row['is_main'] == 1 )
                    $gateway_method = 8;
            } else if ($row['gateway_type'] == '4') {
                $cash['enabled'] = $row['is_main'];
            }
        }
        $this->assign('braintree', $braintree, true);
        $this->assign('paypal', $paypal, true);
        $this->assign('payu', $payu, true);
        $this->assign('payu_latam', $payu_latam, true);
        $this->assign('cash', $cash);
        
        $this->assign('gateway_method', $gateway_method, true);
        $tip = array(
            'enabled' => $this->tab['value3'],
        );
        $this->assign('tip', $tip);

        // ---------------------------------------------------------------
        // ---------------------------------------------------------------


        // ---------------------------------------------------------------
        // Email Settings Load
        // ---------------------------------------------------------------

        OrdersEmailModel::set_strip_state(false);
        $cor = OrdersEmailModel::get_order_confirmation_email($this->app_id, $this->tab_id);
        OrdersEmailModel::set_strip_state(true);

        if ( empty($cor) || !$cor["id"] ) {
            $text = '';

            // Using translation
            $text = "";
            $html = $this->phrases["build_ordering_email_detail_pre_confirmation_email_template"];
            $ordereditems_list = $this->phrases["build_ordering_email_detail_pre_ordered_items_template"];

            $cor = array(
                "id" => "",
                // "tab_id" => $data['tab_id'],
                "tab_id" => $this->tab_id,
                "subject" => $this->phrases["build_ordering_email_detail_text_new_order_placed"],
                "message_text" => $text,
                "message" => $html,
                "admin_subject" => $this->phrases["build_ordering_email_detail_text_new_order_placed"],
                "admin_message_text" => $text,
                "admin_message" => $html,
                "ordered_items_tpl" => $ordereditems_list,
                "order_type_reserve" => "",
                "order_type_delivery" => "",
                "order_type_takeout" => "",
                "order_type_dine" => "",
                "checkout_method_reserve" => "",
                "checkout_method_paypal" => "",
                "checkout_method_cash" => "",
                "checkout_method_card" => ""
            );
        }

        if ( $cor['admin_subject'] == '' ) {
            $cor['admin_subject'] = $cor['subject'];
        }
        if ( $cor['admin_message'] == '' ) {
            $cor['admin_message'] = $cor['message'];
        }
        
        if ( $cor['checkout_method_card'] == '' ) {
            $cor['checkout_method_card'] = $this->phrases['build_label_card'];
        }
        
        $this->assign('email', $cor, true);
        $this->assign('email_raw', $cor);


        // ---------------------------------------------------------------
        // ---------------------------------------------------------------



        // ---------------------------------------------------------------
        // Email Settings' Available Object Part
        // ---------------------------------------------------------------
        // Show available objects with translation
        $available_email_objects = array(
            'ordering_email_detail_pre_email_object_checkout_method',
            //'ordering_email_detail_pre_email_object_cost',
            //'ordering_email_detail_pre_email_object_currency',
            'ordering_email_detail_pre_email_object_delivery_name',
            'ordering_email_detail_pre_email_object_delivery_phone',
            'ordering_email_detail_pre_email_object_delivery_email',
            'ordering_email_detail_pre_email_object_delivery_address',
            'ordering_email_detail_pre_email_object_delivery_address_1',
            'ordering_email_detail_pre_email_object_delivery_address_2',
            'ordering_email_detail_pre_email_object_delivery_city',
            'ordering_email_detail_pre_email_object_delivery_state',
            'ordering_email_detail_pre_email_object_delivery_zip',
            'ordering_email_detail_pre_email_object_order_no',
            'ordering_email_detail_pre_email_object_order_address_1',
            'ordering_email_detail_pre_email_object_order_address_2',
            'ordering_email_detail_pre_email_object_order_city',
            'ordering_email_detail_pre_email_object_order_state',
            'ordering_email_detail_pre_email_object_order_zip',
            // {ORDER_NAME} {ORDER_NOTE }field are available for the {ORDEREDITEMS_LIST}
            //'ordering_email_detail_pre_email_object_order_name',
            //'ordering_email_detail_pre_email_object_order_note',
            'ordering_email_detail_pre_email_object_order_time',
            'ordering_email_detail_pre_email_object_order_type',
            'ordering_email_detail_pre_email_object_ordereditems_list',
            'ordering_email_detail_pre_email_object_tip'
        );

        /* Begin for native food ordering only */
        if ($this->tab['sub_version'] == 1) {
            $available_email_objects[] = 'ordering_email_detail_pre_email_object_place_time';
        }
        /* End for native food ordering only */
        // This is for only ordered item template
        //$available_email_objects[] = 'ordering_email_detail_pre_email_object_quantity';

        $available_email_objects[] = 'ordering_email_detail_pre_email_object_tax';
        $available_email_objects[] = 'ordering_email_detail_pre_email_object_total';

        $translated_email_objects = array();
        foreach ( $available_email_objects as $object_key ) {
            $translated_email_objects[] = $this->phrases['build_' . $object_key];
        }
        $this->assign('email_obj', implode('<br />', $translated_email_objects));


        // Show available objects with translation (for ordered item template)
        $available_email_objects_for_ordered_item = array(
            //'ordering_email_detail_pre_email_object_checkout_method',
            'ordering_email_detail_pre_email_object_cost',
            'ordering_email_detail_pre_email_object_currency',
            'ordering_email_detail_pre_email_object_options',
            //'ordering_email_detail_pre_email_object_delivery_address_1',
            //'ordering_email_detail_pre_email_object_delivery_address_2',
            //'ordering_email_detail_pre_email_object_delivery_city',
            //'ordering_email_detail_pre_email_object_delivery_state',
            //'ordering_email_detail_pre_email_object_delivery_zip',
            //'ordering_email_detail_pre_email_object_ordereditems_list',
            'ordering_email_detail_pre_email_object_order_address_1',
            'ordering_email_detail_pre_email_object_order_address_2',
            'ordering_email_detail_pre_email_object_order_city',
            'ordering_email_detail_pre_email_object_order_state',
            'ordering_email_detail_pre_email_object_order_zip',
            'ordering_email_detail_pre_email_object_order_name',
            'ordering_email_detail_pre_email_object_order_note',
            //'ordering_email_detail_pre_email_object_order_time',
            //'ordering_email_detail_pre_email_object_order_total',
            //'ordering_email_detail_pre_email_object_order_type',
            'ordering_email_detail_pre_email_object_quantity',
            //'ordering_email_detail_pre_email_object_tax'
        );

        $translated_email_objects_for_ordered_item = array();
        foreach ( $available_email_objects_for_ordered_item as $object_key ) {
            $translated_email_objects_for_ordered_item[] = $this->phrases['build_' . $object_key];
        }
        $this->assign('email_obj_4items', implode('<br />', $translated_email_objects_for_ordered_item));


        // ---------------------------------------------------------------
        // ---------------------------------------------------------------


        //---------------------------------------------------------------------------
        //Printers
        //---------------------------------------------------------------------------
        AppPrinterModel::set_strip_state(false);
        $printers = AppPrinterModel::get_app_printers($this->tab_id);
        AppPrinterModel::set_strip_state(true);

        $gp = array();
        for ($i = 0; $i < count($printers); $i++) {

            $pr = $printers[$i];

            $gp[$i] = array(
                'id' => $pr['id'],
                'title' => $pr['title'],
                'location_id' => isset($loc_index[$pr['location_id']])?$loc_index[$pr['location_id']]:'0',
                'seq' => count($printers) - $i,
                'ref_id' => $i,
                'google_printers' => json_decode($pr['google_printers']),
            );
        }

        //--------------------------------------------------------
        //Retrieve Printer Summary
        //--------------------------------------------------------
        // $current_printer_settings = get_app_printer($conn, $auth_user[id], $data[tab_id]);

        //--------------------------------------------------------------------------------------------
        // Google Integration Header Process
        //--------------------------------------------------------------------------------------------
        $me = getMyInstance();
        $is_partner = is_partner();
        $_SESSION['google_auth_code'] = '';

        $google_client = GoogleHelper::getGoogleClient4Printer ($this->app_id, $this->tab_id, $is_partner, $me);
        if ( $google_client && !$google_client->getAccessToken() ) {
            $auth = $google_client->createAuthUrl();
        }

        //--------------------------------------------------------------------------------------------
        // Generate Google Login/out link
        //--------------------------------------------------------------------------------------------

        if ($is_partner) {
            $WHITE_LABEL_URL = "http://mobilefoodprinter.com/google_printer_v2.php";
        } else {
            $WHITE_LABEL_URL = get_site_url() . "/whitelabel/google_printer_v2.php";
        }

        $param = array(
            "app_id" => $this->app_id,
            "tab_id" => $this->tab_id,
            "is_partner" => $is_partner,
            "me" => $me,
            "act" => 'on',
            "domain" => $is_partner?get_site_url():get_site_url().'/cms',
        );
        $WHITE_LABEL_URL .= "?" . http_build_query($param);

        // $WHITE_LABEL_URL = get_site_url() . '/cms/v2/ajax.php?route=tab.orderingView.google_auth&' . http_build_query($param);

        $this->assign("GOOGLE_LINK_URL_ON", $WHITE_LABEL_URL);
        $this->assign("GOOGLE_LINK_LABEL_ON", $this->phrases["build_label_connect_google_printer"]);

        $this->assign("GOOGLE_LINK_URL_OFF", '');
        $this->assign("GOOGLE_LINK_LABEL_OFF", $this->phrases["build_label_disconnect_google_printer"]);

        $gp_on = '1';
        $gp_setting = AppGoogleModel::get_by_tab($this->app_id, $this->tab_id);
        if (!empty($gp_setting) && ((($gp_setting['is_legacy'] == '1') && $is_partner) || (($gp_setting['is_legacy'] != '1') && !$is_partner))) {
            $gp_on = '0';
        } else {
            if (isset($auth)) {
                $gp_on = '0';
            }
        }


        // ---------------------------------------------------------------
        // ---------------------------------------------------------------


        //--------------------------------------------------------------------------------------------
        // Get Menu Data
        //--------------------------------------------------------------------------------------------

        $menu_data = array();

        RestaurantMenuModel::set_strip_state(false);
        $cats = RestaurantMenuModel::get_restaurant_menus($this->app_id, $this->tab_id);
        RestaurantMenuModel::set_strip_state(true);

        $cats_count = count($cats);
        $cat_ind = 0;

        foreach ($cats AS $cat) {

            $header_img = $this->get_header_id($cat['image']);
            $header_url = '';

            if ( is_url($cat["image"]) ) {
                $header_url = $cat['image'];
            }

            $menu = array(
                'id' => $cat['id'],
                'label' => $cat['label'],
                'is_active' => $cat['is_active'],

                'thumb_id' => $header_img['id'],
                'thumb_filename' => basename($header_img['path']),
                'thumb_link' => $header_img['link'],
                'thumb_url' => $header_url,

                'ref_id' => $cat_ind,
                'seq' => $cats_count - $cat_ind,
            );
            
            $menu['items'] = array();

            RestaurantItemModel::set_strip_state(false);
            $items = RestaurantItemModel::get_restaurant_items_simple($menu['id']);
            RestaurantItemModel::set_strip_state(true);
            $items_count = count($items);
            /*
            $ind = 0;
            foreach ($items AS $item) {

                $thumb = $this->get_thumbnail_id($item['image_url']);
                
                $thumb_url = '';
                if ( is_url($item["image_url"]) ) {
                    $thumb_url = $item['image_url'];
                }

                // --- item location --------------------
                $ilocs = unserialize($item['locations']);
                $ilocs_new = array();
                // Now, should be convereted into index from db id
                for ($iloc_ind = 0; $iloc_ind < count($ilocs); $iloc_ind++) {
                    if (isset($loc_index[$ilocs[$iloc_ind]])) {
                        $ilocs_new[] = $loc_index[$ilocs[$iloc_ind]];
                    }
                }
                sort($ilocs_new);
                // in CMS V1, if no location is set, it treast as if all locations are set
                
                // if (count($ilocs) < 1) {
                //     $ilocs = $loc_all4item;
                // }
                

                $menu_item = array(
                    'menu_id' => $cat_ind, //$item['menu_id'],
                    'item_name' => $item['item_name'],
                    'description' => $item['description'],
                    'price' => $item['price'],// number_format($item['price'], 2, '.', ''),
                    'is_available' => $item['is_available'],
                    'tax_exempted' => $item['tax_exempted'],
                    'locations' => $ilocs_new,

                    'id' => $item['id'],
                    'ref_id' => $ind,
                    'seq' => $items_count - $ind, //$row['seq'], re-build order here

                    'thumb_id' => $thumb['id'],
                    'thumb_filename' => basename($thumb['path']),
                    'thumb_link' => $thumb['link'],
                    'thumb_url' => $thumb_url,

                    'ots' => RestaurantTimeModel::get_item_time_set($main_info['id'], $item['id']),
                    'opt' => array(),
                    'size' => RestaurantItemSizeModel::get_restaurant_item_sizes_refined($item['id']),
                );
    
                // Now get item options
                // first, let's correct some invalid data 
                RestaurantItemOptionGroupModel::group_data_correction($item['id']);
                // and then go to get them all
                if ($is_release_cedar == '1') {
                    $opt_groups = RestaurantItemOptionGroupModel::get_restaurant_item_option_group_refined($item['id']);
                    for($g_ind=0; $g_ind<count($opt_groups); $g_ind++) {
                        $opt_groups[$g_ind]['opt'] = RestaurantItemOptionsModel::get_restaurant_item_options_refined_by_group($opt_groups[$g_ind]['id']);
                    }
                    $menu_item['opt'] = $opt_groups;
                } else {
                    $menu_item['opt'] = RestaurantItemOptionsModel::get_restaurant_item_options_refined($item['id']);
                }

                $menu['items'][] = $menu_item;

                $ind ++;

            }

            $menu['item_maxNo'] = $ind;*/
            $menu['item_maxNo'] = $items_count;
            $menu_data[] = $menu;

            $cat_ind ++;
        }
        // -------------------------------------------------------------------------------------------
        // -------------------------------------------------------------------------------------------
        $this->assign_merchandise_svg();

        $html = $this->render_only_template();

        $this->ajax_response(true, array(
            'html' => $html,
            'data' => array(
                'imported_count' => $imported_count,
                'locs' => $locs,
                'app_locs' => $locations[2],
                'app_loc_index' => $locations[1],
                'timezones' => $timezones,
                'tax' => $tax,
                'gp_on' => $gp_on,
                'gpData' => $gp,
                'menuData' => $menu_data,
                'is_new' => $is_new_ordering?'1':'0',
                'is_for_cedar' => $is_release_cedar,
            )
        ));
    }

    public function load_items () {

        $app_id = $this->get_app_id();
        $tab_id = RequestHelper::get_var('id', 0);
        $menu_id = RequestHelper::get_var('menu_id', 0);
        $main_id = RequestHelper::get_var('main_id', 0);

        $is_release_cedar = ArrayHelper::is_release_cedar($this->app['code']) ? '1' : '0';

        RestaurantItemModel::set_strip_state(false);
        $items = RestaurantItemModel::get_restaurant_items_simple($menu_id);
        RestaurantItemModel::set_strip_state(true);
        $items_count = count($items);
        
        $menu_items = array();

        $ind = 0;
        foreach ($items AS $item) {

            $thumb = $this->get_thumbnail_id($item['image_url']);
            
            $thumb_url = '';
            if ( is_url($item["image_url"]) ) {
                $thumb_url = $item['image_url'];
            }

            // --- item location --------------------
            $ilocs = unserialize($item['locations']);

            $menu_item = array(
                // 'menu_id' => $cat_ind, //$item['menu_id'],
                'item_name' => $item['item_name'],
                'description' => $item['description'],
                'price' => $item['price'],// number_format($item['price'], 2, '.', ''),
                'is_available' => $item['is_available'],
                'tax_exempted' => $item['tax_exempted'],
                'locations' => $ilocs,

                'id' => $item['id'],
                'ref_id' => $ind,
                'seq' => $items_count - $ind, //$row['seq'], re-build order here

                'thumb_id' => $thumb['id'],
                'thumb_filename' => basename($thumb['path']),
                'thumb_link' => $thumb['link'],
                'thumb_url' => $thumb_url,

                'ots' => RestaurantTimeModel::get_item_time_set($main_id, $item['id']),
                'opt' => array(),
                'size' => RestaurantItemSizeModel::get_restaurant_item_sizes_refined($item['id']),
            );

            // Now get item options
            // first, let's correct some invalid data 
            RestaurantItemOptionGroupModel::group_data_correction($item['id']);
            // and then go to get them all
            if ($is_release_cedar == '1') {
                $opt_groups = RestaurantItemOptionGroupModel::get_restaurant_item_option_group_refined($item['id']);
                for($g_ind=0; $g_ind<count($opt_groups); $g_ind++) {
                    $opt_groups[$g_ind]['opt'] = RestaurantItemOptionsModel::get_restaurant_item_options_refined_by_group($opt_groups[$g_ind]['id'], $item['id']);
                }
                $menu_item['opt'] = $opt_groups;
            } else {
                $menu_item['opt'] = RestaurantItemOptionsModel::get_restaurant_item_options_refined($item['id']);
            }

            $menu_items[] = $menu_item;

            $ind++;
        }

        header('content-type: application/json; charset=utf-8');
        echo json_encode($menu_items);
        exit;
    }


    private function get_locs() {
        BLoader::import('appLocations');
        $indexing = false;
        $locs = false;

        AppLocationsModel::set_strip_state(false);
        $locations = AppLocationsModel::get_locations_by_app_id($this->app_id);
        AppLocationsModel::set_strip_state(true);

        for ($i = 0; $i < count($locations); $i++) {
            $locations[$i]['address_string'] = $this->get_formatted_addr($locations[$i]);
            $indexing[$locations[$i]['address_string']] = $i;
            $locs[$locations[$i]['id']] = $locations[$i];
        }

        return array($locations, $indexing, $locs);
    }

    private function get_formatted_addr($qry) {
        $top_row_text = $qry["address_top_row"];
        $bottom_row_text = $qry["address_bottom_row"];
        $alt_address = trim("$top_row_text $bottom_row_text");

        $address_string = strlen($alt_address) > 0 ? $alt_address : "$qry[address_1] $qry[zip]";

        $row_formatted_address = $qry["formatted_address"];
        if (empty($row_formatted_address)) {
            $address = array();
            if (!empty($qry['address_1']) || !empty($qry['address_2'])) {
                $address[] = trim($qry['address_1'] . " " . $qry['address_2']);
            }
            if (!empty($qry['city'])) {
                $address[] = $qry['city'];
            }
            if (!empty($qry['state'])) {
                $address[] = $qry['state'];
            }
            if (!empty($qry['country'])) {
                $address[] = $qry['country'];
            }
            $address_string = implode(", ", $address);
            // $row_formatted_address = $address_string;
        }
        return $address_string;
    }

    private function get_header_id ($album_art) {

        $thumbs = array(
            'id' => '',
            'path' => '',
            'link' => '',
        );

        $WEB_ROOT_PATH = get_web_root();

        $path = FileHelper::find_upload_dir($this->app_id) . DS . 'ordering' . DS . 'menus' . DS . $album_art;

        if (SecureHelper::_file_exists($path)) {
            $real_file = $path;
            $thumbs['id'] = ImageHelper::get_id($real_file, 'custom');
            $thumbs['path'] = $real_file;
            $thumbs['link'] = ImageHelper::get_custom_image_url($this->app_id, 'ordering_menu', array('filename' => basename($real_file), 'width' => 120, 'height' => 60, 'a'=>'wh'));

        } else if (!SecureHelper::_file_exists($path)) {  // Library Image
            $path = $WEB_ROOT_PATH . DS . 'images' . DS . 'ordering_menus' . DS . substr($album_art, 2);
            if (SecureHelper::_file_exists($path)) {
                $thumbs['id'] = ImageHelper::get_id($path, 'lib');
                $thumbs['path'] = $path;
                $thumbs['link'] = '/images/ordering_menus/' . substr($album_art, 2) . '?width=120&height=60&a=wh';
            }
        }

        return $thumbs;
    }


    private function get_thumbnail_id ($album_art) {

        $thumbs = array(
            'id' => '',
            'path' => '',
            'link' => '',
        );

        $path = FileHelper::find_upload_dir($this->app_id) . DS . 'ordering' . DS . $album_art;

        if (SecureHelper::_file_exists($path) && SecureHelper::_is_link($path)) {
            $real_file = readlink($path);
            $thumbs['id'] = ImageHelper::get_id($real_file, 'custom');
            $thumbs['path'] = $real_file;
            
            /* check if target file of symlink is old path (thumb path) or not, if yes, we need to copy and recreate symlink - Douglas */
            $old_thumb_path = ImageHelper::get_image_dir($this->app_id, 'thumb', 'custom') . DS . basename($real_file);
            if (SecureHelper::_file_exists($old_thumb_path) && $real_file == $old_thumb_path) {
                $new_path = ImageHelper::get_image_dir($this->app_id, 'product', 'custom') . DS . basename($real_file);
                if (!SecureHelper::_file_exists($new_path)) {
                    SecureHelper::_copy($old_thumb_path, $new_path);
                    SecureHelper::_unlink_force($path);
                    SecureHelper::_symlink($new_path, $path);
                }
                $thumbs['path'] = $new_path;
            }

            $thumbs['link'] = ImageHelper::get_custom_image_url($this->app_id, 'product', array('filename' => basename($real_file), 'width' => 50, 'height' => 50, 'a' => 'wh'));
        }
        
        if ( json_encode($thumbs) === false ) {
            $thumbs = array(
                'id' => '',
                'path' => '',
                'link' => '',
            );
        }
        
        return $thumbs;
    }


    /**
     * Get model of tab.
     * @return html
     */
    public function model() {
        $html = $this->render_only_template();
        $this->ajax_response(true, array(
            'html' => $html
        ));
    }


    /*
     __             ___
    /__`  /\  \  / |__
    .__/ /~~\  \/  |___

    */
    public function save() {

        $user_data = $_REQUEST;
        $data = RequestHelper::make_data_safe($user_data);

        // ---------------------------------------------
        // Let's save stor opt first
        // ---------------------------------------------
        foreach ($this->oServices AS $k => $v) {
            $row = array(
                'store_name' => $v[0],
                'api_key' => '',
                'api_secret' => '',
                'base_domain' => '',
                'cart_url' => $data['url_' . $k],
                'enable_store' => ($data['active_store'] == $k)?'1':'0',
            );
            MstStoreinfoModel::modify_from($row, $this->app_id, $this->tab_id);
        }
        // ---------------------------------------------
        // ---------------------------------------------


        // ---------------------------------------------
        // Tab location and opentime save
        // ---------------------------------------------

        // $to_be_kept = [];
        // foreach ($data['locs'] AS $loc) {
        //     $to_be_kept[] = $loc['id'];
        // }
        // TabLocationsModel::delete_except_for($to_be_kept, $this->tab_id);
        if (isset($data['locs']['removed']))
            TabLocationsModel::delete_by_ids($data['locs']['removed'], $this->tab_id);

        if (!empty($data['locs']['changed'])) {
            foreach ($data['locs']['changed'] AS $loc_k => $loc) {

                /*
                $timezone_row = TimezoneModel::get_timezone($loc['time_zone']);
                $loc['dstOffset'] = ($timezone_row)?'0':$timezone_row['timezone_value'];
                */

                /* get dst offset */
                $address = urlencode(
                    $loc["address_1"]." ".
                    $loc["address_2"]." ".
                    $loc["city"]." ".
                    $loc["state"]." ".
                    $loc["zip"]);

                $param = array("address" => $address);
                $url = GoogleHelper::apiUrl("geocode", $param);
                $ch = curl_init();

                curl_setopt($ch, CURLOPT_URL, $url);
                curl_setopt($ch, CURLOPT_HEADER, 0); //Change this to a 1 to return headers
                curl_setopt($ch, CURLOPT_USERAGENT, $_SERVER["HTTP_USER_AGENT"]);
                curl_setopt($ch, CURLOPT_FOLLOWLOCATION, 1);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);

                $response = curl_exec($ch);
                curl_close($ch);

                // update google api request count(for usage limit)
                GoogleHelper::increaseGoogleApiRquestCount("geocode");
                $geo_info = json_decode($response,true);

                $location = array();
                $dstOffset = 0;
                if ($geo_info["status"] == "OK") {
                    $location['lat'] = $geo_info["results"][0]["geometry"]["location"]["lat"];
                    $location['long'] = $geo_info["results"][0]["geometry"]["location"]["lng"];

                    $loc_info = implode(",", $location);
                    // if latitude and longtitude are decided, get dstOffset
                    // timestamp should be current time for current location

                    // $data[timezone] timezone index
                    date_default_timezone_set('GMT');
                    $currentTime = time() + $loc['dstOffset'] * 3600;

                    $param = array(
                        "location" => $loc_info,
                        "timestamp" => $currentTime
                    );
                    $url = GoogleHelper::apiUrl("timezone", $param);
                    $ch = curl_init();

                    curl_setopt($ch, CURLOPT_URL, $url);
                    curl_setopt($ch, CURLOPT_HEADER, 0); //Change this to a 1 to return headers
                    curl_setopt($ch, CURLOPT_USERAGENT, $_SERVER["HTTP_USER_AGENT"]);
                    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, 1);
                    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);

                    $response = curl_exec($ch);
                    curl_close($ch);

                    $timezoneInfo = json_decode($response,true);
                    if ($timezoneInfo["status"] == "OK"){
                        $dstOffset = $timezoneInfo["dstOffset"];
                    }

                    // update google api request count(for usage limit)
                    GoogleHelper::increaseGoogleApiRquestCount("timezone");
                }

                $loc['dstOffset'] = $dstOffset;

                if ($loc['use_global_timezone'] == 1) {
                    $loc['timezone'] = -1;
                }

                $idv = TabLocationsModel::modify_from($loc, $this->tab_id);
                TabLocationTimeModel::modify_from($loc['ots'], $idv);
                $data['locs'][$loc_k]['id'] = $idv;
            }
        }

        /*
        // No idea why it fetches address info from google again....
        BLoader::import_helper('Google');

        $address = urlencode(
            $user_data["address_1"]." ".
            $user_data["address_2"]." ".
            $user_data["city"]." ".
            $user_data["state"]." ".
            $user_data["zip"]);

        $param = array(
            "address" => $address
        );
        $url = GoogleHelper::apiUrl("geocode", $param);
        $ch = curl_init();

        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_HEADER,0); //Change this to a 1 to return headers
        curl_setopt($ch, CURLOPT_USERAGENT, $_SERVER["HTTP_USER_AGENT"]);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, 1);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);

        $response = curl_exec($ch);
        curl_close($ch);

        // update google api request count(for usage limit)
        GoogleHelper::increaseGoogleApiRquestCount("geocode");
        $geo_info = json_decode($response,true);

        $location = array();
        $dstOffset = 0;
        if ($geo_info["status"] == "OK"){
            $location['lat'] = $geo_info["results"][0]["geometry"]["location"]["lat"];
            $location['long'] = $geo_info["results"][0]["geometry"]["location"]["lng"];

            $loc_info = implode(",", $location);
            // if latitude and longtitude are decided, get dstOffset
            // timestamp should be current time for current location

            // $data[timezone] timezone index
            date_default_timezone_set('GMT');
            $sql = "SELECT timezone_value FROM timezone WHERE id=$data[timezone]";
            $res = mysql_query($sql, $conn);
            $qry = mysql_fetch_array($res);
            $timezoneValue = $qry['timezone_value'];
            $currentTime = time() + $timezoneValue*3600;

            $param = array(
                "location" => $loc_info,
                "timestamp" => $currentTime
            );
            $url = GoogleHelper::apiUrl("timezone", $param);
            $ch = curl_init();

            curl_setopt($ch, CURLOPT_URL, $url);
            curl_setopt($ch, CURLOPT_HEADER,0); //Change this to a 1 to return headers
            curl_setopt($ch, CURLOPT_USERAGENT, $_SERVER["HTTP_USER_AGENT"]);
            curl_setopt($ch, CURLOPT_FOLLOWLOCATION, 1);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);

            $response = curl_exec($ch);
            curl_close($ch);

            $timezoneInfo = json_decode($response,true);
            if ($timezoneInfo["status"] == "OK"){
                $dstOffset = $timezoneInfo["dstOffset"];
            }

            // update google api request count(for usage limit)
            GoogleHelper::increaseGoogleApiRquestCount("timezone");
        }
        */

        // ---------------------------------------------
        // ---------------------------------------------


        // ---------------------------------------------
        // Restaurant Info Saving
        // ---------------------------------------------
        if (isset($data['delivery_radius']) && isset($data['delivery_radius_type']) && $data['delivery_radius_type'] == '1') {
            $data['delivery_radius'] = floatval($data['delivery_radius']);
            $data['delivery_radius'] *= 1.609344;
        }
        RestaurantModel::modify_from($data, $this->app_id, $this->tab_id);
        $restaurant = RestaurantModel::get_restaurant_info($this->app_id, $this->tab_id);
        $restaurant_id = $restaurant['id'];
        // ---------------------------------------------
        // ---------------------------------------------


        // ---------------------------------------------
        // Tax data save
        // ---------------------------------------------
        $to_be_kept = [];
        if (!isset($data['tax'])) $data['tax'] = array();
        foreach ($data['tax'] AS $tax) {
            $to_be_kept[] = $tax['id'];
        }
        TaxModel::delete_except_for($to_be_kept, $this->app_id, $this->tab_id);

        foreach ($data['tax'] AS $tax) {
            TaxModel::modify_from($tax, $this->app_id, $this->tab_id);
        }
        // ---------------------------------------------
        // ---------------------------------------------


        // ---------------------------------------------
        // Payment Options Save
        // ---------------------------------------------
        /*
        if ( $this->is_test_app() == false ) {
            
            $braintree = array(
                'gateway_type' => '5',
                'gateway_appid' => getMyInstance(),
                'gateway_key' => $data['braintree_id'],
                'gateway_password' => $data['braintree_public_key'],
                'gateway_signature' => $data['braintree_private_key'],
                'others' => '',
                'is_main' => $data['braintree_isactive'],
            );
            MstOptionsModel::modify_from($braintree, $this->app_id, $this->tab_id);
         
        } else {
        */
            // Create spreedly for gateway
            $sly = new SpreedlyHelper();

            $no_payment = array(
                'gateway_type' => '0',
                'gateway_appid' => getMyInstance()
            );
            
            $braintree = array(
                'gateway_type' => '5',
                'gateway_appid' => getMyInstance(),
                'gateway_key' => $data['braintree_id'],
                'gateway_password' => $data['braintree_public_key'],
                'gateway_signature' => $data['braintree_private_key']
            );
            
            $paypal = array(
                'gateway_type' => '6',
                'gateway_appid' => getMyInstance(),
                'gateway_key' => $data['paypal_api_username'],
                'gateway_password' => $data['paypal_api_password'],
                'gateway_signature' => $data['paypal_signature']
            );
            
            $payu = array(
                'gateway_type' => '7',
                'gateway_appid' => getMyInstance(),
                'gateway_key' => $data['payu_merchantkey'],
                'gateway_password' => $data['payu_salt'],
                'gateway_signature' => ''
            );
            $payu_latam = array(
                'gateway_type' => '8',
                'gateway_appid' => $data['payu_latam_merchantid'],
                'gateway_key' => $data['payu_latam_accountid'],
                'gateway_password' => $data['payu_latam_apilogin'],
                'gateway_signature' => $data['payu_latam_apikey']
            );
            
            if ( $data['payment_gateway'] == 0 ) {
                $no_payment['is_main'] = 1;
                $braintree['is_main'] = 0;
                $paypal['is_main'] = 0;
                $payu['is_main'] = 0; 
                $payu_latam['is_main'] = 0;                                
                          
            }else if ( $data['payment_gateway'] == 5 ) {
                $no_payment['is_main'] = 0;
                $braintree['is_main'] = 1;
                $paypal['is_main'] = 0;
                $payu['is_main'] = 0;   
                $payu_latam['is_main'] = 0;                              
                          
            } else if ( $data['payment_gateway'] == 6 ) {
                $no_payment['is_main'] = 0;
                $braintree['is_main'] = 0;
                $paypal['is_main'] = 1;
                $payu['is_main'] = 0;
                $payu_latam['is_main'] = 0;
                
                // Create spreedly paypal payment gateway 
                $payment_gateway_type = 'paypal';
                //$payment_gateway_type = 'test';     // Change this from test to live mode
                $paypal_info = MstOptionsModel::get_mst_category($this->app_id, $this->tab_id, 6);
                if( $paypal_info['gateway_key'] != $data['paypal_api_username'] || $paypal_info['gateway_password'] != $data['paypal_api_password'] || $paypal_info['gateway_signature'] != $data['paypal_signature'] ) {
                    $token = $sly->create_gateway( $payment_gateway_type, array(
                        'mode' => 'signature',
                        'login' => $data['paypal_api_username'],
                        'password' => $data['paypal_api_password'],
                        'signature' => $data['paypal_signature']                        
                    ) ); 
                    $paypal['others'] = $token['gateway']['token'];   
                } else {
                    $paypal['others'] = $paypal_info['others'];
                }
                // Save spreedly paypal gateway token to others
                
                           
            } else if ( $data['payment_gateway'] == 7 ) {
                $no_payment['is_main'] = 0;
                $braintree['is_main'] = 0;
                $paypal['is_main'] = 0;
                $payu['is_main'] = 1; 
                $payu_latam['is_main'] = 0;
                
                // Create spreedly payu payment gateway 
                $payment_gateway_type = 'payu_in';
                //$payment_gateway_type = 'test';  // Change status from dev to prod
                $payu_info = MstOptionsModel::get_mst_category($this->app_id, $this->tab_id, 7);
                if ( $payu_info['gateway_key'] != $data['payu_merchantkey'] || $payu_info['gateway_password'] != $data['payu_salt'] ) {
                    $token = $sly->create_gateway( $payment_gateway_type, array(
                        'merchant_key' => $data['payu_merchantkey'],
                        'salt' => $data['payu_salt']                        
                    ) ); 
                    // Save spreedly payu gateway token to others
                    $payu['others'] = $token['gateway']['token'];   
                } else {
                    $payu['others'] = $payu_info['others'];    
                }
                
                
                           
            } else if ( $data['payment_gateway'] == 8 ) {
                $no_payment['is_main'] = 0;
                $braintree['is_main'] = 0;
                $paypal['is_main'] = 0;
                $payu['is_main'] = 0; 
                $payu_latam['is_main'] = 1;
                
                // Create spreedly payu payment gateway 
                $payment_gateway_type = 'payu_latam';
                // $payment_gateway_type = 'test';        
                $payu_latam_info = MstOptionsModel::get_mst_category($this->app_id, $this->tab_id, 8);
                if( $payu_latam_info['gateway_appid'] != $data['payu_latam_merchantid'] || $payu_latam_info['gateway_key'] != $data['payu_latam_accountid'] || $payu_latam_info['gateway_password'] != $data['payu_latam_apilogin'] || $payu_latam_info['gateway_signature'] != $data['payu_latam_apikey'] ) {
                    $token = $sly->create_gateway( $payment_gateway_type, array(
                        'merchant_id' => $data['payu_latam_merchantid'],
                        'account_id' => $data['payu_latam_accountid'],
                        'api_login' => $data['payu_latam_apilogin'],
                        'api_key' => $data['payu_latam_apikey']                        
                    ) );
                
                    // Save spreedly payu gateway token to others
                    $payu_latam['others'] = $token['gateway']['token'];    
                } else {
                    $payu_latam['others'] = $payu_latam_info['others'];    
                }
                          
            }
            
            MstOptionsModel::modify_from($braintree, $this->app_id, $this->tab_id);
            MstOptionsModel::modify_from($paypal, $this->app_id, $this->tab_id);
            MstOptionsModel::modify_from($payu, $this->app_id, $this->tab_id);
            MstOptionsModel::modify_from($payu_latam, $this->app_id, $this->tab_id);
            

        $cash = array(
            'gateway_type' => '4',
            'gateway_appid' => '',
            'gateway_key' => '',
            'gateway_password' => '',
            'gateway_signature' => '',
            'others' => '',
            'is_main' => $data['cash_isactive'],
        );
        MstOptionsModel::modify_from($cash, $this->app_id, $this->tab_id);

        // ---------------------------------------------
        // ---------------------------------------------

        // ---------------------------------------------
        // Email Settings Update
        // ---------------------------------------------
        OrdersEmailModel::modify_from($data, $this->app_id, $this->tab_id);
        // ---------------------------------------------
        // ---------------------------------------------

        // ---------------------------------------------
        // Tab Info Update
        // ---------------------------------------------
        $now = time();
        AppTabsModel::update_tab_app(
            array(
                'tab_label'     => $data['tab_name'],//htmlspecialchars($data['tab_name'], ENT_QUOTES, 'UTF-8'),
                'last_updated'  => $now,
                'value2'  => $data['value2'],
                'value3'  => $data['tip_isactive'],
            ), $this->tab_id, $this->app_id
        );
        // ---------------------------------------------
        // ---------------------------------------------

        // ---------------------------------------------
        // Printer Settgins save
        // ---------------------------------------------
        $to_be_kept = [];
        if (!isset($data['gp'])) $data['gp'] = array();
        foreach ($data['gp'] AS $gp) {
            $to_be_kept[] = $gp['id'];
        }
        AppPrinterModel::delete_except_for($to_be_kept, $this->app_id, $this->tab_id);

        foreach ($data['gp'] AS $gp) {
            // ------------------------------
            // In order to keep newly added locations, too, client returnes location index, not db id
            // so should convert location index to db id
            if (isset($data['locs'][$gp['location_id']])) {
                $gp['location_id'] = $data['locs'][$gp['location_id']]['id'];
            } else {
                $gp['location_id'] = '0';
            }

            $item_locs = array();
            foreach ($item['locations'] AS $loc) {
                if (isset($data['locs'][$loc])) {
                    $item_locs[] = "" . $data['locs'][$loc]['id'];
                }
            }
            $item['locations'] = $item_locs;
            // ------------------------------

            $idv = AppPrinterModel::modify_from($gp, $this->app_id, $this->tab_id);
        }
        // ---------------------------------------------
        // ---------------------------------------------


        // ---------------------------------------------
        // Ordering Item Save
        // ---------------------------------------------
        // $to_be_kept_cat = array();
        if (isset($data['cats']['removed']))
            RestaurantMenuModel::delete_by_ids($data['cats']['removed'], $this->app_id, $this->tab_id);
        if (isset($data['cats']['changed'])) {
            foreach ($data['cats']['changed'] AS $cat) {
                $cat_id = $cat['id'];
                if ($cat['changed'])
                    $cat_id = RestaurantMenuModel::modify_from($cat, $this->app_id, $this->tab_id);

                // $to_be_kept_cat[] = $cat_id;

                // $to_be_kept_item = array();
                if (isset($cat['removedItems'])) {
                    $removed_item_ids = [];
                    $removed_opt_grp_ids = [];
                    $removed_opt_ids = [];
                    $removed_size_ids = [];
                    foreach ($cat['removedItems'] as $item) {
                        $removed_item_ids[] = $item['id'];
                        if (isset($item['opt'])) {
                            foreach ($item['opt'] as $opt) {
                                if ($data['is_for_cedar'] == '1') {
                                    $removed_opt_grp_ids[] = $opt['id'];
                                    if (isset($opt['opt'])) {
                                        foreach ($opt['opt'] as $in_opt) {
                                            $removed_opt_ids[] = $in_opt['id'];
                                        }
                                    }
                                } else {
                                    $removed_opt_ids[] = $opt['id'];
                                }
                            }
                        }
                        if (isset($item['size'])) {
                            foreach ($item['size'] as $size) {
                                $removed_size_ids[] = $size['id'];
                            }
                        }
                    }
                    RestaurantItemModel::delete_by_ids($removed_item_ids, $cat_id);
                    RestaurantItemOptionsModel::delete_by_ids($removed_opt_ids);
                    if ($data['is_for_cedar'] == '1') {
                        RestaurantItemOptionGroupModel::delete_by_ids($removed_opt_grp_ids);
                    }
                    RestaurantItemSizeModel::delete_by_ids($removed_size_ids);
                }

                foreach ($cat['items'] AS $item) {

                    // ------------------------------
                    // In order to keep newly added locations, too, client returnes location index, not db id
                    // so should convert location index to db id
                    /*$item_locs = array();
                    if (isset($item['locations'])) {
                        foreach ($item['locations'] AS $loc) {
                        // foreach ($data['locs'] AS $loc => $loc_det) {
                            if (isset($data['locs'][$loc])) {
                            // if (in_array($loc, $item['locations']) {
                                $item_locs[] = "" . $data['locs'][$loc]['id'];
                            }
                        }
                    }
                    $item['locations'] = $item_locs;*/
                    // ------------------------------

                    $item_id = RestaurantItemModel::modify_from($item, $cat_id);
                    // $to_be_kept_item[] = $item_id;

                    // === Save Options ===========================================
                    $to_be_kept_opt = array();
                    $to_be_kept_opt_group = array();
                    if (isset($item['opt'])) {
                        foreach ($item['opt'] AS $opt) {
                            // let's check if this is cedar data or not, i.e, if this is opt group data or not
                            // if (array_key_exists('ots')) {
                            if ($data['is_for_cedar'] == '1') {

                                $opt_group_id = RestaurantItemOptionGroupModel::modify_from($opt, $item_id);
                                $to_be_kept_opt_group[] = $opt_group_id;

                                if (isset($opt['opt'])) {
                                    foreach ($opt['opt'] AS $in_opt) {
                                        $in_opt['group_id'] = $opt_group_id;
                                        $opt_id = RestaurantItemOptionsModel::modify_from($in_opt, $item_id);
                                        $to_be_kept_opt[] = $opt_id;
                                    }
                                }

                            } else {
                                $opt_id = RestaurantItemOptionsModel::modify_from($opt, $item_id);
                                $to_be_kept_opt[] = $opt_id;
                            }
                        }
                    }
                    
                    RestaurantItemOptionsModel::delete_except_for($to_be_kept_opt, $item_id);
                    if ($data['is_for_cedar'] == '1') {
                        RestaurantItemOptionGroupModel::delete_except_for($to_be_kept_opt_group, $item_id);
                    }
                    
                    // Now correct option data
                    RestaurantItemOptionGroupModel::group_data_correction($item_id);

                    // === Save Sizes ===========================================
                    $to_be_kept_size = array();
                    if (isset($item['size'])) {
                        foreach ($item['size'] AS $size) {
                            $size_id = RestaurantItemSizeModel::modify_from ($size, $item_id);
                            $to_be_kept_size[] = $size_id;
                        }
                    }
                    RestaurantItemSizeModel::delete_except_for($to_be_kept_size, $item_id);

                    RestaurantTimeModel::modify_from($item['ots'], $restaurant_id, $item_id);
                    /*
                    'ots' => RestaurantTimeModel::get_item_time_set($main_info['id'], $item['id']),
                    'opt' => RestaurantItemOptionsModel::get_restaurant_item_options($item['id']),
                    'size' => RestaurantItemSizeModel::get_restaurant_item_sizes($item['id']),
                    */

                    // let's upload thumb file for the item
                    ImageHelper::copy_v2_to_v1_atom($this->app, $this->tab, $item['thumb_filename'], "custom", $item, 'product');

                    /*
                    if ($item['thumb_filename'] !== '') {

                        $dir = FileHelper::find_upload_dir($this->app_id) . "/ordering";
                        $s3_key = 'custom_images/' . $this->app['code'] . '/ordering/' . $item['thumb_filename'];
                        S3Uploader::Get()->uploadObject($s3_key, $dir . '/' . $item['thumb_filename'], 'image/png');

                        // Upload custom dimension image
                        $s3_key = 'custom_images/' . $this->app['code'] . '/ordering/' . $item['thumb_filename'] . '--width-50--height-50';

                        $imageObj = new SimpleImage();
                        $imageObj->load($dir . '/' . $item['thumb_filename']);
                        $imageObj->resize(50, 50);

                        ob_start();
                        $imageObj->output($imageObj->get_image_type());
                        $img_cont = ob_get_contents();
                        ob_end_clean();
                        imagedestroy($imageObj->image);

                        S3Uploader::Get()->uploadObject($s3_key, $img_cont, 'image/png', true);
                    }
                    */

                }
                // RestaurantItemModel::delete_except_for($to_be_kept_item, $cat_id);
            }
        }
        // RestaurantMenuModel::delete_except_for($to_be_kept_cat, $this->app_id, $this->tab_id);
        
        // ---------------------------------------------
        // ---------------------------------------------

        $return_data = array(
            'msg' => $this->phrases['build_label_success_save_tab_data'],
            // 'tab_name' => $user_data['tab_name'],
        );

        $this->ajax_response(true, $return_data);

    }

    public function google_auth_off() {

        $me = getMyInstance();
        $is_partner = is_partner();

        $google_client = GoogleHelper::getGoogleClient4Printer ($this->app_id, $this->tab_id, $is_partner, $me, false, true);

        $this->ajax_response(true, array(
            'msg' => $this->phrases['build_desc_google_printer_disconnected'],
            'data' => array (),
        ));
        exit;

    }

    public function switch2new() {
        $now = time();
        AppTabsModel::update_tab_app(
            array(
                'view_controller'  => 'FoodOrderingViewController',
                'last_updated'  => $now,
            ), $this->tab_id, $this->app_id
        );

        $this->ajax_response(true, array(
            'msg' => 'Done',
        ));
        exit;
    }

}


