<?php
/**
 * EventsViewController.php
 *
 * This class supports the controller for events v2 tab.
 *
 * @author Austin L <auslee986@gmail.com>
 * @version 1.0
 */


include_once ('eventbrite/Eventbrite.php');

BLoader::import('appTabs, timezone, countries, apps');
BLoader::import_helper('request, image, array');

class EventsImportController extends Controller {
	/**
	 * Constructor.
	 */
     
    var $timeFormat = "H:i";
    
	public function __construct($opts)
	{
        parent::__construct($opts);

        $this->rules = array(
            '*' => 'auth.client_loggedin'
        );
        include_once "inc/Helper/BizHelper.functions.inc";
        $ip_address = get_ip();
        $is_location_us = 0;
        
        $ip_location = LocationHelper::get_address_array_with( array($ip_address) );
        
        if ( $ip_location->{$ip_address}->country_code == "US" ) {
            $is_location_us = 1;
        }
        if ( $is_location_us == 1 ) {
            $timeFormat = "H:i A";
        }

	}


    function eb_get() { // Event Brite get function


        $data = RequestHelper::get_safe_data($_REQUEST);

        $result = array(
            'success' => false,
            'error' => '',
            'events' => false,
        );

        // Let's save eventbrite user email and password
        AppTabsModel::update_tab_app(
            array(
                'value12' => $data['email'] . "|||" . $data['password'],
                'value13' => 2, // Import type
            ), $data['tab_id'], $this->app_id);


        $authentication_tokens = array(
            'app_key' => '3HVXH3Q33BAN7CFSNL', 
        );

        try {
            $eb_client = new Eventbrite('3HVXH3Q33BAN7CFSNL', $data['email'], $data['password']);
            
            $user_events = $eb_client->user_list_events();
            
            if ( $user_events->events ) {
                
                $result['success'] = true;
                $result['events'] = $user_events->events;
            } else {
                $result['error'] = $this->phrases['build_desc_no_events'];
            }
        } catch ( Exception $e ) {
            
            $result['error'] = $e->getMessage();
            
        }
        $this->ajax_response($result['success'], $result);


    }


    function prepare_event() { // prepare event in Event Brite for BA

        $default_timezone = 4;
        
        // get us citizon or not
        include_once "inc/Helper/BizHelper.functions.inc";
        $ip_address = get_ip();
        $is_location_us = 0;
        
        $ip_location = LocationHelper::get_address_array_with( array($ip_address) );
        
        if ( $ip_location->{$ip_address}->country_code == "US" ) {
            $is_location_us = 1;
        }
        $timeFormat = 'H:i';
        if ( $is_location_us == 1 ) {
            $timeFormat = "h:i A";
        }
        $data = RequestHelper::get_safe_data($_REQUEST);

        $ref_event = array();

        /* For bulk event process - Douglas 20161003 */
        $app_id = $_SESSION['auth_user_id'];
        $app_info = AppsModel::get_app($app_id);
        $is_testapp = ArrayHelper::is_testapp($app_info['code']);
        if ($is_testapp) {
            $ref_events = array();
            $events = array();
        }

        if ($data['import_type'] == '2') { // Even Brite Import

            $ref_event = $data['ref_event']['event'];

            $timezone_offset = intval( str_ireplace('GMT', '', $ref_event['timezone_offset']) );
            $timezone_value = floor( $timezone_offset / 100 ) + floor( $timezone_offset % 100 ) / 60;
            
            $timezone_object = TimezoneModel::get_timezone_by_value( number_format( $timezone_value, 1 ) );
            
            // Set timezone as event brite timezone
            //date_default_timezone_set($timezone_object['abbr']);
            $start_timestamp = strtotime($ref_event['start_date']);
            $end_timestamp = strtotime($ref_event['end_date']);
            
            // Set timezone as app global timezone
            /*$app_id = $_SESSION['auth_user_id'];
            $app_info = AppsModel::get_app($app_id);*/
            $current_app_timezone_id = $app_info['timezone'];
            $current_app_timezone_abbr = TimezoneModel::get_abbr($current_app_timezone_id);
            //date_default_timezone_set($current_app_timezone_abbr);
            
            $event_from = date('m/d/Y ' . $timeFormat, $start_timestamp);
            $event_to = date('m/d/Y ' . $timeFormat, $end_timestamp);
            
            // date_default_timezone_set($default_timezone);

            $event = array (

                'name' => $ref_event['title'],
                'description' => $ref_event['description'],
                'is_active' => '1',

                'timezone' => '' . ($timezone_object ? $timezone_object['id'] : 0),
                'use_global_timezone' => '0',

                // for Single Events
                'time_from_str' => $event_from, // Only in single event
                'time_to_str' => $event_to, // Only in single event

                'is_recur' => '0',

                'thumb_id' => '',
                'thumb_path' => '',
                'thumb_id_ipad' => '',
                'thumb_path_ipad' => '',

                'formatted_address' => '',
            );

            if ($ref_event['logo']) {
                // $app_id = $_SESSION['auth_user_id'];
                $copied = ImageHelper::curl_remote_image($app_id, 'tab_header', array('url' => $ref_event['logo'], 'device' => 'phone'));
                /*
                "success" => true,
                "filename" => $filename,
                "fullpath" => $dest_file
                */

                // for now only copy into phone device, no tablet device yet

                $event['thumb_id'] = ImageHelper::get_id($copied['filename'], 'custom');
                $event['thumb_path'] = $copied['filename'];
            }

            if ($ref_event['venue']) {
                $mapping_key = array(
                    'latitude' => 'latitude',
                    'longitude' => 'longitude',
                    'addr_1' => 'address',
                    'addr_2' => 'address_2',
                    'city' => 'city',
                    'state' => 'region',
                    'zip' => 'postal_code',
                    'country' => 'country_code',
                );

                foreach ($mapping_key AS $kv => $vv) {
                    $event[$kv] = $ref_event['venue'][$vv];
                }
            }


        } else if ($data['import_type'] == '0') { // Facebook import

            $ref_event = $data['ref_event'];
            // Get timezone value
            $start_time = $ref_event['start_time'];
            
            
            list ($date, $time) = explode('T', $start_time);
                    
            if ($time) {
                $offset = substr($time, -5);
            }
            
            $timezone_value = intval($offset)/100;
            $timezone_object = TimezoneModel::get_timezone_by_value( number_format( $timezone_value, 1 ) );
            
            
            $start_timestamp = strtotime($ref_event['start_time']);
            $end_timestamp = strtotime($ref_event['end_time']);
        
            
            // Set timezone as app global timezone
            /*$app_id = $_SESSION['auth_user_id'];
            $app_info = AppsModel::get_app($app_id);*/
            $current_app_timezone_id = $app_info['timezone'];
            $current_app_timezone_abbr = TimezoneModel::get_abbr($current_app_timezone_id);
            //date_default_timezone_set($current_app_timezone_abbr);
                        
            $event_from = date('m/d/Y ' . $timeFormat, $start_timestamp);
            $event_to = date('m/d/Y ' . $timeFormat, $end_timestamp);  //Change to_time to end_time

            $event = array (

                'name' => $ref_event['name'],
                'description' => ($ref_event['description'] ? $ref_event['description'] : ''),
                'is_active' => '1',

                'timezone' => '' . ($timezone_object ? $timezone_object['id'] : 0),
                'use_global_timezone' => '0',

                // for Single Events
                'time_from_str' => $event_from, // Only in single event
                'time_to_str' => $event_to, // Only in single event

                'is_recur' => '0',

                'thumb_id' => '',
                'thumb_path' => '',
                'thumb_id_ipad' => '',
                'thumb_path_ipad' => '',

                'formatted_address' => '',
            );

            if ($ref_event['logo']) {
                // $app_id = $_SESSION['auth_user_id'];
                $copied = ImageHelper::curl_remote_image($app_id, 'tab_header', array('url' => $ref_event['logo'], 'device' => 'phone'));
                /*
                "success" => true,
                "filename" => $filename,
                "fullpath" => $dest_file
                */

                // for now only copy into phone device, no tablet device yet

                $event['thumb_id'] = ImageHelper::get_id($copied['filename'], 'custom');
                $event['thumb_path'] = $copied['filename'];
            }

            if ($ref_event['place'] && $ref_event['place']['location']) {
                $mapping_key = array(
                    'latitude' => 'latitude',
                    'longitude' => 'longitude',
                    'addr_1' => 'street',
                    'city' => 'city',
                    'state' => 'region',
                    'zip' => 'zip',
                    'country' => 'country',
                );

                foreach ($mapping_key AS $kv => $vv) {
                    $event[$kv] = $ref_event['place']['location'][$vv];
                }

                $country_code = CountriesModel::get_country_code($event['country']);
                $event['country'] = $country_code;
            }

        } else if ($data['import_type'] == '1') { // Google import

            /* Bulk event process - Douglas 20161003 */
            if ($is_testapp) {
                $ref_events = json_decode($data['ref_events'], true);

                foreach ($ref_events as $ref_event) {

                    $event_timezone_abbr = $ref_event['timezone_abbr'];
                    $timezone_object = TimezoneModel::get_timezone_by_offset(doubleval($ref_event['timezone_value']));
                    if ( $event_timezone_abbr != '' ) {
                        $timezone_object = TimezoneModel::get_timezone_by_abbr($event_timezone_abbr);
                    } 
                    if ( !$timezone_object ) {
                        $timezone_object = TimezoneModel::get_timezone_by_offset(doubleval($ref_event['timezone_value']));
                    }    
                    
                    // $default_timezone = date_default_timezone_get();
                    
                    //date_default_timezone_set($timezone_object['abbr']);
                    
                    //S
                    $event_timezone_value = $ref_event['timezone_value'];
                    
                    // Set timezone as app global timezone
                    /*$app_id = $_SESSION['auth_user_id'];
                    $app_info = AppsModel::get_app($app_id);*/
                    $current_app_timezone_id = $app_info['timezone'];
                    $current_app_timezone = TimezoneModel::get_timezone($current_app_timezone_id);
                    $current_app_timezone_value = $current_app_timezone['timezone_value'];
                    $timezone_offset = $current_app_timezone_value - $event_timezone_value;
                    $start_time_stamp = $ref_event['start_date'] + 3600 * $timezone_offset;
                    $end_time_stamp = $ref_event['end_date'] + 3600 * $timezone_offset;
                    
                    $event_from = date('m/d/Y ' . $timeFormat, $ref_event['start_date']);
                    $event_to = date('m/d/Y ' . $timeFormat, $ref_event['end_date']);
                    
                    // date_default_timezone_set($default_timezone);
                    
                    // date_default_timezone_set($default_timezone);
                    $event = array (

                        'name' => $ref_event['name'],
                        'description' => $ref_event['description'],
                        'is_active' => '1',
                        'isDST' => $ref_event['is_DST'],
                        'timezone' => '' . ($timezone_object ? $timezone_object['id'] : 0),
                        'use_global_timezone' => '0',

                        // for Single Events
                        'time_from_str' => $event_from, // Only in single event
                        'time_to_str' => $event_to, // Only in single event

                        'is_recur' => '0',

                        'thumb_id' => '',
                        'thumb_path' => '',
                        'thumb_id_ipad' => '',
                        'thumb_path_ipad' => '',

                        'formatted_address' => '',

                        'google_id' => $ref_event['id'],
                    );


                    if ($ref_event['location']) { // this is just string value
                        $event['formatted_address'] = $ref_event['location'];
                        
                        // let s retrieve location details via google location api
                        $arg['formatted_address'] = $ref_event['location'];
                        $arg = $this->get_geo_info($arg);

                        $event = array_merge($event, $arg);
                    }

                    $events[] = $event;
                }
            }
            else {
                $ref_event = $data['ref_event'];
                
                $event_timezone_abbr = $ref_event['timezone_abbr'];
                $timezone_object = TimezoneModel::get_timezone_by_offset(doubleval($ref_event['timezone_value']));
                if ( $event_timezone_abbr != '' ) {
                    $timezone_object = TimezoneModel::get_timezone_by_abbr($event_timezone_abbr);
                } 
                if ( !$timezone_object ) {
                    $timezone_object = TimezoneModel::get_timezone_by_offset(doubleval($ref_event['timezone_value']));
                }    
                
                // $default_timezone = date_default_timezone_get();
                
                //date_default_timezone_set($timezone_object['abbr']);
                
                //S
                $event_timezone_value = $ref_event['timezone_value'];
                
                // Set timezone as app global timezone
                /*$app_id = $_SESSION['auth_user_id'];
                $app_info = AppsModel::get_app($app_id);*/
                $current_app_timezone_id = $app_info['timezone'];
                $current_app_timezone = TimezoneModel::get_timezone($current_app_timezone_id);
                $current_app_timezone_value = $current_app_timezone['timezone_value'];
                $timezone_offset = $current_app_timezone_value - $event_timezone_value;
                $start_time_stamp = $ref_event['start_date'] + 3600 * $timezone_offset;
                $end_time_stamp = $ref_event['end_date'] + 3600 * $timezone_offset; 
                
                $event_from = date('m/d/Y ' . $timeFormat, $ref_event['start_date']);
                $event_to = date('m/d/Y ' . $timeFormat, $ref_event['end_date']);
                
                // date_default_timezone_set($default_timezone);
                
                // date_default_timezone_set($default_timezone);
                $event = array (

                    'name' => $ref_event['name'],
                    'description' => $ref_event['description'],
                    'is_active' => '1',
                    'isDST' => $ref_event['is_DST'],
                    'timezone' => '' . ($timezone_object ? $timezone_object['id'] : 0),
                    'use_global_timezone' => '0',

                    // for Single Events
                    'time_from_str' => $event_from, // Only in single event
                    'time_to_str' => $event_to, // Only in single event

                    'is_recur' => '0',

                    'thumb_id' => '',
                    'thumb_path' => '',
                    'thumb_id_ipad' => '',
                    'thumb_path_ipad' => '',

                    'formatted_address' => '',

                    'google_id' => $ref_event['id'],
                );


                if ($ref_event['location']) { // this is just string value
                    $event['formatted_address'] = $ref_event['location'];
                    
                    // let s retrieve location details via google location api
                    $arg['formatted_address'] = $ref_event['location'];
                    $arg = $this->get_geo_info($arg);

                    $event = array_merge($event, $arg);
                }
            }

            
        }


        /* Bulk event process - Douglas 20161003 */
        if ($is_testapp) {
            $refined_events = array();
            foreach ($events as $event) {
                // let's compoase formatted address
                $event['formatted_address'] = $this->get_formatted_addr($event);
                $event = $this->last_refine($event);

                $refined_events[] = $event;
            }
            $result = array(
                'success' => true,
                'ref_events' => $ref_events,
                'events' => $refined_events,
            );
            
        } else {
            // let's compoase formatted address
            $event['formatted_address'] = $this->get_formatted_addr($event);
            
            $event = $this->last_refine($event);

            $result = array(
                'success' => true,
                'ref_event' => $ref_event,
                'event' => $event,
            );
        }


        $this->ajax_response($result['success'], $result);

    }

    private function last_refine ($args) {
        
        $formatted_address = $args['formatted_address'];
        $pos = strpos($formatted_address, ',');
        $top_address = trim( substr($formatted_address, 0, $pos) );
        $bottom_address = trim( substr($formatted_address, $pos) );
        if ( $bottom_address[0] == ',' ) {
            $bottom_address[0] ='';
        }
        if (trim($args['address_1']) == '') $args['address_1'] = trim($top_address);
        if (trim($args['address_2']) == '') $args['address_2'] = trim($bottom_address);

        return $args;
    }


    private function get_formatted_addr($qry) {
        $row_formatted_address = $qry["formatted_address"];
        if(empty($row_formatted_address)) {
            $address = array();
            if(!empty($qry['address_1']) || !empty($qry['address_2'])) {
                $address[] = trim($qry['address_1'] . " " . $qry['address_2']);
            }
            if(!empty($qry['city'])) {
                $address[] = $qry['city'];
            }
            if(!empty($qry['state'])) {
                $address[] = $qry['state'];
            }
            if(!empty($qry['country'])) {
                $address[] = $qry['country'];
            }
            $address_string = implode(", ", $address);
            $row_formatted_address = $address_string;
        }
        return $row_formatted_address;
    }

    public function get_geo_info($args) {


        // Initialize.
        if (!isset($args['formatted_address']) && !isset($args['latitude']) && !isset($args['longitude'])) {
          return $args;
        }

        BLoader::import_helper('Google');

        $param = array();
        if (isset($args['latitude']) && isset($args['longitude'])) {
            $param = array(
                "latlng" => $args['latitude'] . ',' . $args['longitude']
            );
        } else if (isset($args['formatted_address'])) {
            $param = array(
                "address" => urlencode($args['formatted_address'])
            );
        }

        $gmap_url = GoogleHelper::apiUrl("geocode", $param);

        /*
        $ch = curl_init();

        curl_setopt($ch, CURLOPT_URL, $gmap_url);
        curl_setopt($ch, CURLOPT_HEADER, 0); // Change this to a 1 to return headers.
        curl_setopt($ch, CURLOPT_USERAGENT, $_SERVER['HTTP_USER_AGENT']);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, 1);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);

        ob_start();
        $response = curl_exec($ch);
        ob_end_clean();
        curl_close($ch);
        */

        $response = file_get_contents($gmap_url);
        $geo_info = json_decode($response, true);

        
        // update google api request count(for usage limit)
        GoogleHelper::increaseGoogleApiRquestCount("geocode");
        


        if ($geo_info['status'] == 'OK') {
          
            if (isset($geo_info['results'][0]['geometry']['location'])) {
                $args['latitude'] = $geo_info['results'][0]['geometry']['location']['lat'];
                $args['longitude'] = $geo_info['results'][0]['geometry']['location']['lng'];
            }

            if (isset($geo_info['results'][0]['formatted_address'])) {
                $args['formatted_address'] = $geo_info['results'][0]['formatted_address'];  
            }

            if (isset($geo_info['results'][0]['address_components'])) {

                foreach ($geo_info['results'][0]['address_components'] as $address) {

                    $addr1KeyList = array('street_number', 'route');
                    $addr2KeyList = array('subpremise', 'premise', 'floor', 'room');

                    foreach($addr1KeyList AS $kv) {
                        if (in_array($kv, $address['types'])) {
                            $args['addr_1'] .= ' ' . $address['long_name'];
                        }
                    }

                    foreach($addr2KeyList AS $kv) {
                        if (in_array($kv, $address['types'])) {
                            $args['addr_2'] .= ' ' . $address['long_name'];
                        }
                    }

                    $args['addr_1'] = trim($args['addr_1']);
                    $args['addr_2'] = trim($args['addr_2']);

                    if (in_array('country', $address['types'])) {
                        $args['country'] = $address['short_name'];
                    }  

                    if (in_array('country', $address['types'])) {
                        $args['country'] = $address['short_name'];
                    }
                    if (in_array('administrative_area_level_1', $address['types'])) {
                        $args['state'] = $address['long_name'];
                    }
                    if (in_array('locality', $address['types'])) {
                        $args['city'] = $address['long_name'];
                    }
                    if (in_array('postal_code', $address['types'])) {
                        $args['zip'] = $address['long_name'];
                    }
                }
            }
        }

        return $args;
    }


    // Useless function for now then
    public function google_auth() {
        

        require_once("google3/Service.php");
        require_once("google3/Service/Resource.php");
        require_once("google3/Service/Calendar.php");
        BLoader::import('GoogleToken');

        $keys = GoogleTokenModel::get_google_keys(); 
        $client_id = $keys['client_id']; 
        $client_secret = $keys['client_secret'];

        $client = new Google_Client();
        $client->setApplicationName('Import Google Calendar Events');
        $client->setClientId($client_id);
        $client->setApprovalPrompt('force');
        $client->setAccessType('offline');
        $client->setClientSecret($client_secret);

        $client->setRedirectUri(get_site_protocol(). '://' . $_SERVER['HTTP_HOST'] . $_SERVER['PHP_SELF'] . '?route=util.eventsImport.google_auth');
        $client->setScopes(
            array(
                'https://www.googleapis.com/auth/userinfo.email', 
                'https://www.googleapis.com/auth/calendar',
                'https://www.googleapis.com/auth/userinfo.profile'
            )
        );

        $service = new Google_Service_Calendar($client);
        $key = GoogleTokenModel::get_session_key();

        if ( isset($_GET['code']) ) {
            $client->authenticate($_GET['code']);
            $_SESSION[$key] = $client->getAccessToken();

            // why reload logic here? something trouble if not reloading?
            /*
            header('Location: '.get_site_protocol().'://' . $_SERVER['HTTP_HOST'] . $_SERVER['PHP_SELF'] . '?route=util.eventsImport.google_auth');
            exit;
            */
        }

        if ( isset($_SESSION[$key]) ) {
            $client->setAccessToken($_SESSION[$key]);
        }


        GoogleTokenModel::reset_counter('process');
        GoogleTokenModel::reset_counter('imported');

        if ( $client->getAccessToken() ) {

            // If able to Access Token Retrieved, then lets load the event list

            $this->layout = 'layouts.blank.layout';
            $this->render('tabs.eventsmanagerview.import-google-auth-done');

            exit;
            
        } else {
            $authUrl = $client->createAuthUrl();
            header('Location: ' . $authUrl);
        }

        // Prevent TPL rendered
        exit;
    }

    // Useless function for now then
    public function google_import_list() {
        

        require_once ("google3/Service.php");
        require_once ("google3/Service/Resource.php");
        require_once ("google3/Service/Calendar.php");
        require_once ("google3/Service/Oauth2.php");
        
        BLoader::import('GoogleToken');


        $result = array(
            'success' => false
        );


        $keys = GoogleTokenModel::get_google_keys(); 
        $client_id = $keys['client_id']; 
        $client_secret = $keys['client_secret'];

        $client = new Google_Client();
        $client->setApplicationName('Import Google Calendar Events');
        $client->setClientId($client_id);
        $client->setClientSecret($client_secret);
        $client->setApprovalPrompt('force');
        $client->setAccessType('offline');
        $client->setRedirectUri(get_site_protocol().'://' . $_SERVER['HTTP_HOST'] . $_SERVER['PHP_SELF']);
        $client->setScopes(array(
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/userinfo.profile'
        ));

        $key = GoogleTokenModel::get_session_key();

        if (isset($_SESSION[$key])) {
            $client->setAccessToken($_SESSION[$key]);
        }

        if ($client->getAccessToken()) {
            
            $oauth2 = new Google_Service_Oauth2($client);
            $google_auth = $oauth2->userinfo->get();
            $service = new Google_Service_Calendar($client);
    
                               
            $cal_ids = GoogleTokenModel::get_cal_ids($service);

            /*
            // Adding watch for event on google, now lets skip this one, really important this???
            $token = $client->getAccessToken();        
            $main = json_decode($token);
            $access_token = $main->access_token;
            
            $calendarId = $google_auth->email;
            GoogleTokenModel::add($token, $data['tab_id'], $calendarId);
            
            foreach($cal_ids as $calendarId)
            {
                $server_type = getMyInstance();

                try {
                    if ( $server_type == 'prod' )
                    {
                        $url = 'https://www.biznessapps.com/cms/event_v2_google_callback.php';
                    }
                    else 
                    {
                        $url = 'https://'.$_SERVER['HTTP_HOST'].'/cms/event_v2_google_callback.php';
                    }//
                    
                    error_log("Setting url: ". $url); 
                    $prefix = is_sandbox() ? 's' : ''; 
                    $channel = new Google_Service_Calendar_Channel($client);//
                    $channel->setAddress($url);
                    $channel->setId($prefix.'mbiznessappsv1_' . $data["tab_id"]."_". base64_encode($calendarId)) ;
                    $channel->setType('web_hook');
                    $watchEvent = $service->events->watch($calendarId, $channel);

                    var_dump($watchEvent);
                    error_log("GOOGLE CAL EVENTS ::: SET WAS OK ::: " .$calendarId);
                } 
                catch (Exception $e) 
                {
                    error_log("GOOGLE CAL EVENTS ::: FAILED TO SET ::: " .$url);
                    error_log(print_r($e->getMessage(), true));
                    error_log(print_r($e, true));
                }   
            }
            */


            $minCheck = date(DATE_ATOM, time());
            $maxCheck = date(DATE_ATOM, mktime(0, 0, 0, 12, 31, date("Y") + 1));

            $totalResult = array();
            $i = 0;
            
            // Get local timezone
            $timezone = intval($this->app['timezone']);
            if ($timezone == 0) {
                $timezone = isset($_COOKIE['local_timezone']) ? $_COOKIE['local_timezone'] : "-6";
            }

            $imported_events = array();


            try {
            
                
                GoogleTokenModel::reset_counter('process');
                        
                $perPage = 10;
                $optParams = array(
                    'singleEvents' => 'true',
                    'maxResults' => $perPage,
                    'timeMin' => $minCheck,
                    'timeMax' => $maxCheck
                );
             
                $html = '';
                $total = 0;
                $uniq = array(); 

                foreach($cal_ids as $cal_id)
                {
                    $events = $service->events->listEvents($cal_id);
                    $found = true;

                    while($found) {

                        foreach ($events->getItems() as $event) {
                                
                            // Let's get event
                            $eId = $event->getId();
                    
                            $start = $event->getStart();
                            $end = $event->getEnd();
                    
                            $from_hour = $from_min = $to_hour = $to_min = 0;
                    
                            if ($start->dateTime) {
                                list ($from_hour, $from_min, $timezone) = $this->google_getTimeAttr($start->dateTime);
                                $start_time = strtotime($start->dateTime);
                            } else
                                if ($start->date) {
                                    $start_time = strtotime($start->date);
                                }
                    
                            if ($end->dateTime) {
                                list ($to_hour, $to_min) = $this->google_getTimeAttr($end->dateTime);
                                $end_time = strtotime($end->dateTime);
                            } else
                                if ($end->date) {
                                    $end_time = strtotime($end->date);
                                }
                    
                            // Check for full day events
                            if ( $start->date && $end->date && ($end_time - $start_time) == 86400 ) {
                                $from_hour = 0;
                                $from_min = 0;
                                $to_hour = 23;
                                $to_min = 55;
                                $end_time = $start_time;
                            }
                    
                            // Check timezone from the event
                            if ( $start->timeZone ) {
                                $google_timezone = timezone_offset_get(new DateTimeZone($start->timeZone), new DateTime()) / 3600;
                    
                                date_default_timezone_set($start->timeZone);
                    
                                $from_hour = date('G', $start_time);
                                $from_min = date('i', $start_time);
                                $start_time = strtotime( date('Y-m-d H:i:s', $start_time) );
                    
                                $to_hour = date('G', $end_time);
                                $to_min = date('i', $end_time);
                                $end_time = strtotime( date('Y-m-d H:i:s', $end_time) );
                    
                                date_default_timezone_set('America/Costa_Rica');
                    
                                $timezone = $google_timezone;
                    
                                // Convert to UTC timezone
                                $start_time += $timezone * 3600;
                                $end_time += $timezone * 3600;
                            }
                    
                            // Fix description for the multiline
                            $new_event = array(
                                'name' => $event->getSummary(),
                                'start_date' => $start_time,
                                'end_date' => $end_time,
                                'timezone_value' => sprintf('%.1f', $timezone),
                                'location' => $event->location,
                                'description' => nl2br( $event->getDescription()),
                                'from_hour' => $from_hour,
                                'from_min' => $from_min,
                                'to_hour' => $to_hour,
                                'to_min' => $to_min,
                                'id' => $eId,
                            );

                            $total ++;

                            
                            $imported_events[] = $new_event;
                        }

                        $pageToken = $events->getNextPageToken();
                        if ($pageToken) {
                            $optParams = array('pageToken' => $pageToken);
                            // $events = $service->events->listEvents('primary', $optParams);
                            $events = $service->events->listEvents($cal_id, $optParams);
                        } else {
                            $found = false; 
                        }
                    }
                }
                        
                $result['success'] = true;
                $result['events'] = $imported_events;
                $result['total'] = $total;


                
            } catch ( Exception $e ) {
                $result['error'] = $e->getMessage();
            }
            
            
        } else {
            
            $result['error'] = 'An error occured while authenticating your Google account. Please close the dialog and try again.';
            
        }

        // okay, import list done, so lets flush the session value
        unset($_SESSION[$key]);

        $this->ajax_response($result['success'], $result);

    }

    // Useless function for now then
    function google_getTimeAttr($fulldate) {
        // Example: 2015-05-12T18:00:00+08:00
        list ($date, $time) = explode('T', $fulldate);
        
        $hour = $min = $offset = 0;
        
        if ($time) {
            list ($hour, $min) = explode(':', $time);
            $offset = substr($time, - 6);
            if ( strpos($offset, ':') === false ) { // Like +0800 format
                $offset = substr($time, - 5);

                $offset_h = intval( substr($offset, 0, 3) );
                $offset_m = intval( substr($offset, -2) ) / 60;
                
                $offset = round($offset_h + $offset_m, 1);
            } else {
                list ($offset_h, $offset_m) = explode(':', $offset);
                $offset_h = intval($offset_h);
                $offset_m = $offset_m / 60;
                
                $offset = round($offset_h + $offset_m, 1);
            }
        }
        
        return array(
            intval($hour),
            intval($min),
            $offset
        );
    }

}


