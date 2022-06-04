<?php
/**
 * TestController.php
 *
 * This class supports the controller for migration.
 *
 * @author Austin L <auslee986@gmail.com>
 * @version 1.0
 */


BLoader::import_helper('appTabs, request, image, array, google');

class GoogleEventController extends Controller {
	/**
	 * Constructor.
	 */
	public function __construct($opts)
	{
        parent::__construct($opts);

        $this->rules = array(
            // '*' => 'auth.client_loggedin'
        );

	}


    public function google_auth() {


        $_SESSION["gp_auth"] = array();

        $user_data = $_REQUEST;
        $data = RequestHelper::make_data_safe($user_data);


        $gp_auth["app_id"] = $data['app_id'];
        $gp_auth["tab_id"] = $data['tab_id'];
        $gp_auth["is_partner"] = $data['is_partner'];
        $gp_auth["me"] = $data['me'];
        $gp_auth["domain"] = $data['domain'];

        $_SESSION['gp_auth'] = $gp_auth;



            $google_client = GoogleHelper::getGoogleClient4Event ($data['app_id'], $data['tab_id'], $data['is_partner'], $data['me']);

            if ( !$google_client->getAccessToken() ) {
                $auth = $google_client->createAuthUrl();
            }

            if ( isset($auth) ) {
                $REDIRECT_URL = $auth;

                header("location: " . $REDIRECT_URL);
                exit;

            } else {
                // Already auth is done, then go on
                
                header("location: " . $gp_auth["domain"] . '/v2/ajax.php?route=util.googleEvent.google_auth_close');

                /*
                $this->layout = 'layouts.blank.layout';
                $this->render('tabs.orderingview.google_auth_done');
                */

            }
   
        
    }

    public function google_auth_done() {

        $data = $_SESSION['gp_auth'];
        $google_client = GoogleHelper::getGoogleClient4Event ($data['app_id'], $data['tab_id'], $data['is_partner'], $data['me'], $_REQUEST['code']);
        $_SESSION["gp_auth"] = array();

        // header("location: " . $data["domain"] . '/v2/ajax.php?route=util.googleEvent.google_auth_close');

        $this->layout = 'layouts.blank.layout';
        $this->render('tabs.eventsmanagerview.google-auth-done');
    }

    public function google_auth_close() {

        $this->layout = 'layouts.blank.layout';
        $this->render('tabs.eventsmanagerview.google-auth-done');
    }
    
    public function checkAvailableImport($tab_id, $e_id, $end_time) {
        BLoader::import('Events');
        
        // Check the event time and it will not import for past 60 days.
        if ( $end_time < strtotime('-60 days') ) {
            return false;
        }
        
        // Check if it has been deleted before
        $event_deleted = EventsModel::check_deleted_google_event($tab_id, $e_id);
        if ( $event_deleted ) {
            return false;
        }
        
        // Check if it has been already imported
        $imported = EventsModel::check_imported_google_event($tab_id, $e_id);
        if ( $imported ) {
            return false;
        }
        
        return true;
    }

    public function google_get_events() {

        require_once ("google3/Service.php");
        require_once ("google3/Service/Resource.php");
        require_once ("google3/Service/Calendar.php");
        require_once ("google3/Service/Oauth2.php");        
        BLoader::import('AppTabs, Events, GoogleToken, Timezone');

        $me = getMyInstance();
        $is_partner = is_partner();
        $google_events = array();

        $data = $_REQUEST;
        if ($_SESSION['auth_user_id']) $data['app_id'] = $_SESSION['auth_user_id'];

        $result = array(
            'success' => false
        );
        
        $default_timezone = date_default_timezone_get();

        try {

            $google_client = GoogleHelper::getGoogleClient4Event ($data['app_id'], $data['tab_id'], $is_partner, $me);
            if ($google_client->getAccessToken()) {
                
                AppTabsModel::update_tab_app(
                    array(
                        'value13' => 1, // Import type
                    ), 
                    $data['tab_id'], 
                    $data['app_id']
                );
                
                $google_service = new Google_Service_Calendar($google_client);
                $cal_ids = GoogleTokenModel::get_cal_ids($google_service);

                // Adding watch for event on google, now lets skip this one, really important this???
                // This is for sync events with Google calendar.
                
                $oauth2 = new Google_Service_Oauth2($google_client);
                $google_auth = $oauth2->userinfo->get();

                $token = $google_client->getAccessToken();        
                $main = json_decode($token);
                $access_token = $main->access_token;
                
                $calendarId = $google_auth->email;
                /*GoogleTokenModel::add($token, $data['tab_id'], $calendarId);
                
                $default_timezone = date_default_timezone_get();
                
                foreach($cal_ids as $calendarId)
                {
                    $server_type = getMyInstance();

                    try {
                        // if ( is_staging() ) {
                        //     $url = 'https://staging.biznessapps.com/cms/event_v2_google_callback.php';
                        // } else {
                        //     $url = 'https://www.biznessapps.com/cms/event_v2_google_callback.php';
                        // }
                        if ( !is_sandbox() ) {
                            $url = 'https://www.biznessapps.com/cms/event_v2_google_callback.php';
                        } else {
                            $url = 'https://' . $_SERVER['HTTP_HOST'] . '/cms/event_v2_google_callback.php';
                        }
                        
                        error_log("Setting url: ". $url); 
                        $prefix = is_sandbox() ? 's' : ''; 
                        $channel = new Google_Service_Calendar_Channel($google_client);//
                        $channel->setAddress($url);
                        $channel->setId($prefix.'mbiznessappsv1_' . $data["tab_id"]."_". base64_encode($calendarId)) ;
                        $channel->setType('web_hook');
                        $watchEvent = $google_service->events->watch($calendarId, $channel);

                        // var_dump($watchEvent);
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
                        $events = $google_service->events->listEvents($cal_id);
                        $found = true;
                        $deleted_recurring_event = array();
                        $deleted_recurring_event_recur_id = array();
                        while($found) {     
                            foreach ($events->getItems() as $event) {
                                $event_status = $event->getStatus();
                                if( $event_status == "cancelled" ) {
                                    $deleted_recurring = $event->getOriginalStartTime();
                                    $deleted_recurring_start = $deleted_recurring->dateTime;
                                    $from_hour = $from_min = 0;
                                    $deleted_recurring_event_recur_id[] = $event->getRecurringEventId();
                                    if ( $deleted_recurring->dateTime ) {
                                        list ($from_hour, $from_min, $timezone, $date) = $this->google_getTimeAttr($deleted_recurring_start);
                                        $deleted_recurring_event[] = strtotime($date . ' ' . $from_hour . ':' . $from_min);
                                    } else if ( $deleted_recurring->date ){
                                        $deleted_recurring_event[] = strtotime($deleted_recurring->date); 
                                    } 
                                }    
                            }
                            
                            foreach ($events->getItems() as $event) {
                                  
                                // Let's get event
                                $eId = $event->getId();
                                
                                // DST
                                $isDST = false;
                                
                                $start = $event->getStart();
                                $end = $event->getEnd();
                                $from_hour = $from_min = $to_hour = $to_min = 0;
                        
                                if ($start->dateTime) {
                                    list ($from_hour, $from_min, $timezone, $date) = $this->google_getTimeAttr($start->dateTime);
                                    $start_time = strtotime($date . ' ' . $from_hour . ':' . $from_min);
                                } else
                                    if ($start->date) {
                                        $start_time = strtotime($start->date);
                                    }
                                
                        
                                if ($end->dateTime) {
                                    list ($to_hour, $to_min, $timezone, $date) = $this->google_getTimeAttr($end->dateTime);
                                    $end_time = strtotime($date . ' ' . $to_hour . ':' . $to_min);
                                } else
                                    if ($end->date) {
                                        $end_time = strtotime($end->date);
                                    }
                                $current_time = time();
                                    
                                // Check for full day events
                                if ( $start->date && $end->date && ($end_time - $start_time) == 86400 ) {
                                    $from_hour = 0;
                                    $from_min = 0;
                                    $to_hour = 23;
                                    $to_min = 55;
                                    $end_time = $start_time;
                                }
                                $timezone_abbr = '';
                                // Check timezone from the event 
                                if ( $start->timeZone ) {
                                    $timezone_abbr = $start->timeZone;
                                    $google_timezone = timezone_offset_get(new DateTimeZone($start->timeZone), new DateTime()) / 3600;
                                    
                                    date_default_timezone_set($start->timeZone);
                                                                        
                                    // Get daylight saving time
                                    $isDST = date('I', $start_time); 
                                    
                                    date_default_timezone_set($default_timezone);
                                    
                                    // Convert to local server timezone
                                    $start_time += ($google_timezone - $timezone) * 3600;
                                    $end_time += ($google_timezone - $timezone) * 3600;
                                    $from_hour = date('G', $start_time);
                                    $from_min = date('i', $start_time);
                                    $to_hour = date('G', $end_time);
                                    $to_min = date('i', $end_time);
                                    
                                    // date_default_timezone_set('UTC');
                                    $timezone = $google_timezone;
                                    if ( $isDST ) {
                                        $timezone = $timezone - 1;
                                    }
                                } 
                                
                                
                                
                                // Check the recurrence
                                $recurrence = $event->getRecurrence();
                                if ( $recurrence ) {
                                    $recurrence_options = explode(';', str_ireplace('RRULE:', '', $recurrence[0]));
                                    
                                    $recurrence_freq = $recurrence_until = $recurrence_byday = '';
                                    $recurrence_count = $recurrence_interval = 0;
                                    
                                    foreach ( $recurrence_options as $roption ) {
                                        list($rk, $rv) = explode('=', $roption);
                                        $rk = trim($rk);
                                        $rv = trim($rv);
                                        if ( strtoupper($rk) == 'FREQ' ) {
                                            $recurrence_freq = $rv;
                                        } else if ( strtoupper($rk) == 'UNTIL' ) {
                                            $recurrence_until = $this->google_getDateAttr($rv);
                                        } else if ( strtoupper($rk) == 'BYDAY' ) {
                                            $recurrence_byday = $rv;
                                        } else if ( strtoupper($rk) == 'COUNT' ) {
                                            $recurrence_count = intval($rv);
                                        } else if ( strtoupper($rk) == 'INTERVAL' ) {
                                            $recurrence_interval = intval($rv);
                                        }
                                    }
                                    
                                    //date_default_timezone_set($start->timeZone); // Now not available
                                    
                                    // Until date
                                    if ( $recurrence_until ) {

                                        $recurrence_until .= ' 23:59:59';
                                        
                                        // Daily
                                        if ( $recurrence_freq == 'DAILY' ) {
                                            
                                            $start_time_pos = $start_time;
                                            $end_time_pos = $end_time;
                                            
                                            $loop_interval = 0;                                            
                                            while ( $start_time_pos <= strtotime($recurrence_until) ) {
                                                $is_deleted_recurring_event = 0;
                                                for ( $i = 0; $i <count( $deleted_recurring_event); $i++) {
                                                    if( $deleted_recurring_event[$i] == $start_time_pos ) {
                                                        $is_deleted_recurring_event = 1;
                                                    }                                                                
                                                }
                                                
                                                if( $is_deleted_recurring_event == 1 ) {
                                                    if ( $recurrence_interval ) {
                                                        $start_time_pos += 3600 * 24 * $recurrence_interval;
                                                        $end_time_pos += 3600 * 24 * $recurrence_interval;
                                                    } else {
                                                        $start_time_pos += 3600 * 24;
                                                        $end_time_pos += 3600 * 24;
                                                    }       
                                                    $loop_interval += 1;
                                                    continue;
                                                }
                                                
                                                $daily_event = true;
                                                
                                                if ( $recurrence_interval ) {
                                                    if ( $loop_interval % $recurrence_interval != 0 )
                                                        $daily_event = false;
                                                }
                                                
                                                // Check available import
                                                if ( !$this->checkAvailableImport($data['tab_id'], $eId . '-r-' . $loop_interval, $end_time_pos) ) {
                                                    $daily_event = false;
                                                }
                                                
                                                if ( $daily_event ) {
                                                    
                                                    if ( $event->getSummary() ) {
                                                        $new_event = array(
                                                            'name' => $event->getSummary(),
                                                            'start_date' => $start_time_pos,
                                                            'end_date' => $end_time_pos,
                                                            'timezone_value' => sprintf('%.1f', $timezone),
                                                            'timezone_abbr' => $timezone_abbr, 
                                                            'is_DST' => $isDST?'1':'0',  
                                                            'location' => $event->location,
                                                            'description' => nl2br( $event->getDescription()),
                                                            'from_hour' => $from_hour,
                                                            'from_min' => $from_min,
                                                            'to_hour' => $to_hour,
                                                            'to_min' => $to_min,
                                                            'id' => $eId . '-r-' . $loop_interval,
                                                            'google_id' => $eId . '-r-' . $loop_interval,
                                                        );

                                                        $google_events[] = $new_event;    
                                                    }
                                                    
                                                }
                                                
                                                $loop_interval++;
                                                
                                                $start_time_pos += 3600 * 24;
                                                $end_time_pos += 3600 * 24;
                                            }
                                            
                                        // Weekly
                                        } else if ( $recurrence_freq == 'WEEKLY' ) {
                                            $recurrence_by_weekdays = array();
                                            if ( $recurrence_byday ) {
                                                $recurrence_byday = explode(',', $recurrence_byday);
                                                foreach ( $recurrence_byday as $wd ) {
                                                    $recurrence_by_weekdays[] = $this->google_weekday_number($wd);
                                                }
                                            }
                                            
                                            $start_time_pos = $start_time;
                                            $end_time_pos = $end_time;
                                            
                                            $loop_interval = 0;
                                            while ( $start_time_pos <= strtotime($recurrence_until) ) {
                                                
                                                $is_deleted_recurring_event = 0;
                                            
                                                for ( $i = 0; $i < count($deleted_recurring_event); $i++) {
                                                    if( $deleted_recurring_event[$i] == $start_time_pos ) {
                                                        $is_deleted_recurring_event = 1;
                                                    }                                                                
                                                }
                                                if( $is_deleted_recurring_event == 1 ) {
                                                    if ( $recurrence_by_weekdays ) {
                                                        $start_time_pos += 3600 * 24;
                                                        $end_time_pos += 3600 * 24;
                                                    } else {
                                                        $start_time_pos += 3600 * 24 * 7;
                                                        $end_time_pos += 3600 * 24 * 7;
                                                    }
                                                    $loop_interval++;
                                                    continue;
                                                }
                                                $weekly_event = true;
                                                if ( $recurrence_by_weekdays ) {
                                                    if ( !in_array(date('w', $start_time_pos), $recurrence_by_weekdays) ) {
                                                        $weekly_event = false;
                                                    }
                                                }
                                                
                                                // Check available import
                                                if ( !$this->checkAvailableImport($data['tab_id'], $eId . '-r-' . $loop_interval, $end_time_pos) ) {
                                                    $weekly_event = false;
                                                }
                                                
                                                if ( $weekly_event ) {
                                                    
                                                    if ( $event->getSummary() ) {
                                                        $new_event = array(
                                                            'name' => $event->getSummary(),
                                                            'start_date' => $start_time_pos,
                                                            'end_date' => $end_time_pos,
                                                            'timezone_value' => sprintf('%.1f', $timezone),
                                                            'timezone_abbr' => $timezone_abbr,
                                                            'is_DST' => $isDST?'1':'0',   
                                                            'location' => $event->location,
                                                            'description' => nl2br( $event->getDescription()),
                                                            'from_hour' => $from_hour,
                                                            'from_min' => $from_min,
                                                            'to_hour' => $to_hour,
                                                            'to_min' => $to_min,
                                                            'id' => $eId . '-r-' . $loop_interval,
                                                            'google_id' => $eId . '-r-' . $loop_interval,
                                                        );

                                                        $google_events[] = $new_event;    
                                                    }
                                                    
                                                }
                                                
                                                $loop_interval++;
                                                
                                                if ( $recurrence_by_weekdays ) {
                                                    $start_time_pos += 3600 * 24;
                                                    $end_time_pos += 3600 * 24;
                                                } else {
                                                    $start_time_pos += 3600 * 24 * 7;
                                                    $end_time_pos += 3600 * 24 * 7;
                                                }
                                            }
                                            
                                        // Monthly
                                        } else if ( $recurrence_freq == 'MONTHLY' ) {
                                            
                                            $start_date = new DateTime( date('Y-m-d H:i:s', $start_time) );
                                            $end_date = new DateTime( date('Y-m-d H:i:s', $end_time) );
                                            
                                            $start_time_pos = $start_time;
                                            $end_time_pos = $end_time;
                                            
                                            $loop_interval = 0;
                                            while ( $start_time_pos <= strtotime($recurrence_until) ) {
                                                

                                                $is_deleted_recurring_event = 0;                                            
                                                
                                                
                                                for ( $i = 0; $i < count($deleted_recurring_event); $i++) {
                                                    if( $deleted_recurring_event[$i] == $start_time_pos ) {
                                                        $is_deleted_recurring_event = 1;
                                                    }                                                                
                                                }
                                                
                                                if ( !$is_deleted_recurring_event ) {
                                                    $monthly_event = true;
                                                    if ( $recurrence_interval ) {
                                                        if ( $loop_interval % $recurrence_interval != 0 )
                                                            $monthly_event = false;
                                                    }
                                                    
                                                    // Check available import
                                                    if ( !$this->checkAvailableImport($data['tab_id'], $eId . '-r-' . $loop_interval, $end_time_pos) ) {
                                                        $monthly_event = false;
                                                    }
                                                    
                                                    if ( $monthly_event ) {
                                                        if ( $event->getSummary() ) {
                                                            $new_event = array(
                                                                'name' => $event->getSummary(),
                                                                'start_date' => $start_time_pos,
                                                                'end_date' => $end_time_pos,
                                                                'timezone_value' => sprintf('%.1f', $timezone),
                                                                'timezone_abbr' => $timezone_abbr,
                                                                'is_DST' => $isDST?'1':'0', 
                                                                'location' => $event->location,
                                                                'description' => nl2br( $event->getDescription()),
                                                                'from_hour' => $from_hour,
                                                                'from_min' => $from_min,
                                                                'to_hour' => $to_hour,
                                                                'to_min' => $to_min,
                                                                'id' => $eId . '-r-' . $loop_interval,
                                                                'google_id' => $eId . '-r-' . $loop_interval,
                                                            );

                                                            $google_events[] = $new_event;    
                                                        }
                                                    }
                                                
                                                }
                                                
                                                
                                                $loop_interval++;
                                                
                                                $days = cal_days_in_month(CAL_GREGORIAN, $start_date->format('n'), $start_date->format('Y'));
                                                $start_date->add(new DateInterval('P' . $days .'D'));
                                                $end_date->add(new DateInterval('P' . $days .'D'));
                                                $start_time_pos = strtotime($start_date->format('Y-m-d H:i:s'));
                                                $end_time_pos = strtotime($end_date->format('Y-m-d H:i:s'));

                                            }
                                            

                                            
                                        }
                                        
                                    // Until count
                                    } else if ( $recurrence_count ) {
                                        // Daily
                                        if ( $recurrence_freq == 'DAILY' ) {
                                            
                                            $start_time_pos = $start_time;
                                            $end_time_pos = $end_time;
                                            
                                            $loop_interval = 0;                                            
                                            while ( $loop_interval < $recurrence_count ) {
                                                
                                                $is_deleted_recurring_event = 0;
                                                for ( $i = 0; $i <count( $deleted_recurring_event); $i++) {
                                                    if( $deleted_recurring_event[$i] == $start_time_pos ) {
                                                        $is_deleted_recurring_event = 1;
                                                    }                                                                
                                                }
                                                
                                                if ( $is_deleted_recurring_event == 1 ) {
                                                    if ( $recurrence_interval ) {
                                                        $start_time_pos += 3600 * 24 * $recurrence_interval;
                                                        $end_time_pos += 3600 * 24 * $recurrence_interval;
                                                    } else {
                                                        $start_time_pos += 3600 * 24;
                                                        $end_time_pos += 3600 * 24;
                                                    }
                                                    $loop_interval += 1;
                                                    continue;
                                                }
                                                
                                                $daily_event = true;
                                                
                                                // Check available import
                                                if ( !$this->checkAvailableImport($data['tab_id'], $eId . '-r-' . $loop_interval, $end_time_pos) ) {
                                                    $daily_event = false;
                                                }
                                                
                                                if ( $daily_event ) {
                                                    
                                                    if ( $event->getSummary() ) {
                                                        $new_event = array(
                                                            'name' => $event->getSummary(),
                                                            'start_date' => $start_time_pos,
                                                            'end_date' => $end_time_pos,
                                                            'timezone_value' => sprintf('%.1f', $timezone),
                                                            'timezone_abbr' => $timezone_abbr, 
                                                            'is_DST' => $isDST?'1':'0',
                                                            'location' => $event->location,
                                                            'description' => nl2br( $event->getDescription()),
                                                            'from_hour' => $from_hour,
                                                            'from_min' => $from_min,
                                                            'to_hour' => $to_hour,
                                                            'to_min' => $to_min,
                                                            'id' => $eId . '-r-' . $loop_interval,
                                                            'google_id' => $eId . '-r-' . $loop_interval,
                                                        );

                                                        $google_events[] = $new_event;    
                                                    }
                                                    
                                                }
                                                
                                                if ( $recurrence_interval ) {
                                                    $start_time_pos += 3600 * 24 * $recurrence_interval;
                                                    $end_time_pos += 3600 * 24 * $recurrence_interval;
                                                } else {
                                                    $start_time_pos += 3600 * 24;
                                                    $end_time_pos += 3600 * 24;
                                                }
                                                
                                                $loop_interval++;
                                                
                                            }
                                            
                                        // Weekly
                                        } else if ( $recurrence_freq == 'WEEKLY' ) { 
                                            $recurrence_by_weekdays = array();
                                            if ( $recurrence_byday ) {
                                                $recurrence_byday = explode(',', $recurrence_byday);
                                                
                                                foreach ( $recurrence_byday as $wd ) {
                                                    $recurrence_by_weekdays[] = $this->google_weekday_number($wd);
                                                }
                                                $recurrence_week_count = count($recurrence_byday);
                                                if ( $recurrence_count % $recurrence_week_count == 0 ) {
                                                    $recurrence_count = intval($recurrence_count / $recurrence_week_count) * 7;
                                                } else {
                                                    $recurrence_count = intval($recurrence_count / $recurrence_week_count) * 7 + intval($recurrence_by_weekdays[($recurrence_count % $recurrence_week_count)]);
                                                }
                                                    
                                            }
                                            
                                            
                                            $start_time_pos = $start_time;
                                            $end_time_pos = $end_time;
                                            
                                            $loop_interval = 0;  
                                            while ( $loop_interval < $recurrence_count ) {
                                                
                                                $is_deleted_recurring_event = 0;   
                                                for ( $i = 0; $i <count( $deleted_recurring_event); $i++) {
                                                    if( $deleted_recurring_event[$i] == $start_time_pos ) {
                                                       if( $deleted_recurring_event_recur_id[$i] == $event->getId() ) 
                                                        $is_deleted_recurring_event = 1;
                                                    }                                                                
                                                } 
                                                $weekly_event = true;
                                                if( $is_deleted_recurring_event == 1 ) {
                                                    $weekly_event = false;  
                                                }
                                                
                                                if ( $recurrence_by_weekdays ) {
                                                    if ( !in_array(date('w', $start_time_pos), $recurrence_by_weekdays) ) {
                                                        $weekly_event = false;
                                                    }
                                                }
                                                // Check available import
                                                if ( !$this->checkAvailableImport($data['tab_id'], $eId . '-r-' . $loop_interval, $end_time_pos) ) {
                                                    $weekly_event = false;
                                                }
                                                if ( $weekly_event ) {
                                                
                                                    if ( $event->getSummary() ) {
                                                        $new_event = array(
                                                            'name' => $event->getSummary(),
                                                            'start_date' => $start_time_pos,
                                                            'end_date' => $end_time_pos,
                                                            'timezone_value' => sprintf('%.1f', $timezone),
                                                            'timezone_abbr' => $timezone_abbr,  
                                                            'is_DST' => $isDST?'1':'0',
                                                            'location' => $event->location,
                                                            'description' => nl2br( $event->getDescription()),
                                                            'from_hour' => $from_hour,
                                                            'from_min' => $from_min,
                                                            'to_hour' => $to_hour,
                                                            'to_min' => $to_min,
                                                            'id' => $eId . '-r-' . $loop_interval,
                                                            'google_id' => $eId . '-r-' . $loop_interval,
                                                        );

                                                        $google_events[] = $new_event;    
                                                    }
                                                    
                                                }
                                                
                                                if ( $recurrence_by_weekdays ) {
                                                    $start_time_pos += 3600 * 24;
                                                    $end_time_pos += 3600 * 24;
                                                } else {
                                                    $start_time_pos += 3600 * 24 * 7;
                                                    $end_time_pos += 3600 * 24 * 7;
                                                }
                                                
                                                $loop_interval++;
                                                
                                            }
                                            
                                        // Monthly
                                        } else if ( $recurrence_freq == 'MONTHLY' ) {
                                            
                                            $start_date = new DateTime( date('Y-m-d H:i:s', $start_time) );
                                            $end_date = new DateTime( date('Y-m-d H:i:s', $end_time) );
                                            
                                            $start_time_pos = $start_time;
                                            $end_time_pos = $end_time;
                                            
                                            $loop_interval = 0;
                                            while ( $loop_interval < $recurrence_count ) {
                                                
                                                $is_deleted_recurring_event = 0;
                                                
                                                for ( $i = 0; $i < count($deleted_recurring_event); $i++) {
                                                    if( $deleted_recurring_event[$i] == $start_time_pos ) {
                                                        $is_deleted_recurring_event = 1;
                                                    }                                                                
                                                }
                                                
                                                if ( !$is_deleted_recurring_event ) {
                                                    $monthly_event = true;
                                                    
                                                    if ( $recurrence_interval ) {
                                                        if ( $loop_interval % $recurrence_interval != 0 )
                                                            $monthly_event = false;
                                                    }
                                                    
                                                    // Check available import
                                                    if ( !$this->checkAvailableImport($data['tab_id'], $eId . '-r-' . $loop_interval, $end_time_pos) ) {
                                                        $monthly_event = false;
                                                    }
                                                    
                                                    if ( $monthly_event ) {
                                                        if ( $event->getSummary() ) {
                                                            $new_event = array(
                                                                'name' => $event->getSummary(),
                                                                'start_date' => $start_time_pos,
                                                                'end_date' => $end_time_pos,
                                                                'timezone_value' => sprintf('%.1f', $timezone),
                                                                'timezone_abbr' => $timezone_abbr, 
                                                                'is_DST' => $isDST?'1':'0',
                                                                'location' => $event->location,
                                                                'description' => nl2br( $event->getDescription()),
                                                                'from_hour' => $from_hour,
                                                                'from_min' => $from_min,
                                                                'to_hour' => $to_hour,
                                                                'to_min' => $to_min,
                                                                'id' => $eId . '-r-' . $loop_interval,
                                                                'google_id' => $eId . '-r-' . $loop_interval,
                                                            );

                                                            $google_events[] = $new_event;    
                                                        }
                                                    }
                                                }
                                                $start_time_pos = strtotime($start_date->format('Y-m-d H:i:s'));
                                                $end_time_pos = strtotime($end_date->format('Y-m-d H:i:s'));
                                                
                                                $days = cal_days_in_month(CAL_GREGORIAN, $start_date->format('n'), $start_date->format('Y'));
                                                $start_date->add(new DateInterval('P' . $days .'D'));
                                                $end_date->add(new DateInterval('P' . $days .'D'));
                                                
                                                $loop_interval++;

                                            }
                                            
                                        }
                                        
                                    } else { // Unlimit recurring event
                                        
                                        $recurrence_count = $data['populate_recurring'];
                                        // Daily
                                        if ( $recurrence_freq == 'DAILY' ) {
                                            $recurrence_count = $recurrence_count * 7;
                                            $start_time_pos = $start_time;
                                            $end_time_pos = $end_time;
                                            
                                            $loop_interval = 0;
                                            $recurrence_iterval = 0;                                            
                                            while ( $loop_interval < $recurrence_count ) {
                                                
                                                $is_deleted_recurring_event = 0;
                                                for ( $i = 0; $i <count( $deleted_recurring_event); $i++) {
                                                    if( $deleted_recurring_event[$i] == $start_time_pos ) {
                                                        $is_deleted_recurring_event = 1;
                                                    }                                                                
                                                }
                                                
                                                // Check the past event
                                                if ( $current_time > $end_time_pos ) {
                                                    
                                                    
                                                    $start_time_pos += 3600 * 24;
                                                    $end_time_pos += 3600 * 24;
                                                    
                                                    continue;
                                                }
                                                
                                                if ( $is_deleted_recurring_event == 1 ) {
                                                    if ( $recurrence_interval ) {
                                                        $start_time_pos += 3600 * 24 * $recurrence_interval;
                                                        $end_time_pos += 3600 * 24 * $recurrence_interval;
                                                    } else {
                                                        $start_time_pos += 3600 * 24;
                                                        $end_time_pos += 3600 * 24;
                                                    }
                                                    $recurrence_iterval+=1;
                                                    continue;
                                                }
                                                
                                                $daily_event = true;
                                                
                                                // Check available import
                                                if ( !$this->checkAvailableImport($data['tab_id'], $eId . '-r-' . $loop_interval, $end_time_pos) ) {
                                                    $daily_event = false;
                                                }
                                                
                                                if ( $daily_event ) {
                                                    
                                                    if ( $event->getSummary() ) {
                                                        $new_event = array(
                                                            'name' => $event->getSummary(),
                                                            'start_date' => $start_time_pos,
                                                            'end_date' => $end_time_pos,
                                                            'timezone_value' => sprintf('%.1f', $timezone),
                                                            'timezone_abbr' => $timezone_abbr,  
                                                            'is_DST' => $isDST?'1':'0',
                                                            'location' => $event->location,
                                                            'description' => nl2br( $event->getDescription()),
                                                            'from_hour' => $from_hour,
                                                            'from_min' => $from_min,
                                                            'to_hour' => $to_hour,
                                                            'to_min' => $to_min,
                                                            'id' => $eId . '-r-' . $loop_interval,
                                                            'google_id' => $eId . '-r-' . $loop_interval,
                                                        );

                                                        $google_events[] = $new_event;    
                                                    }
                                                    
                                                }
                                                
                                                if ( $recurrence_interval ) {
                                                    $start_time_pos += 3600 * 24 * $recurrence_interval;
                                                    $end_time_pos += 3600 * 24 * $recurrence_interval;
                                                } else {
                                                    $start_time_pos += 3600 * 24;
                                                    $end_time_pos += 3600 * 24;
                                                }
                                                $loop_interval++;
                                                
                                            }
                                            
                                        // Weekly
                                        } else if ( $recurrence_freq == 'WEEKLY' ) {
                                            
                                            $recurrence_by_weekdays = array();
                                            if ( $recurrence_byday ) {
                                                $recurrence_byday = explode(',', $recurrence_byday);
                                                foreach ( $recurrence_byday as $wd ) {
                                                    $recurrence_by_weekdays[] = $this->google_weekday_number($wd);
                                                }
                                            }
                                            
                                            $start_time_pos = $start_time;
                                            $end_time_pos = $end_time;
                                            $loop_interval = 0;
                                            
                                            if ( $recurrence_by_weekdays ) {
                                                $recurrence_count = $recurrence_count * 7;
                                            }
                                            while ( $loop_interval < $recurrence_count ) {
                                                
                                                $is_deleted_recurring_event = 0;
                                                for ( $i = 0; $i <count( $deleted_recurring_event); $i++) {
                                                    if( $deleted_recurring_event[$i] == $start_time_pos ) {
                                                        $is_deleted_recurring_event = 1;
                                                    }                                                                
                                                }
                                                if( $is_deleted_recurring_event == 1 ) {
                                                    if ( $recurrence_by_weekdays ) {
                                                        $start_time_pos += 3600 * 24;
                                                        $end_time_pos += 3600 * 24;
                                                    } else {
                                                        $start_time_pos += 3600 * 24 * 7;
                                                        $end_time_pos += 3600 * 24 * 7;
                                                    }
                                                    continue;
                                                }
                                                // Check the past event
                                                if ( $current_time > $end_time_pos ) {
                                                    
                                                    if ( $recurrence_by_weekdays ) {
                                                        $start_time_pos += 3600 * 24;
                                                        $end_time_pos += 3600 * 24;
                                                    } else {
                                                        $start_time_pos += 3600 * 24 * 7;
                                                        $end_time_pos += 3600 * 24 * 7;
                                                    }
                                                    
                                                    continue;
                                                } 
                                                
                                                $weekly_event = true;
                                                if ( $recurrence_by_weekdays ) {
                                                    if ( !in_array(date('w', $start_time_pos), $recurrence_by_weekdays) ) {
                                                        $weekly_event = false;
                                                    }
                                                }
                                                
                                                // Check available import
                                                if ( !$this->checkAvailableImport($data['tab_id'], $eId . '-r-' . $loop_interval, $end_time_pos) ) {
                                                    $weekly_event = false;
                                                }
                                                
                                                if ( $weekly_event ) {
                                                
                                                    if ( $event->getSummary() ) {
                                                        $new_event = array(
                                                            'name' => $event->getSummary(),
                                                            'start_date' => $start_time_pos,
                                                            'end_date' => $end_time_pos,
                                                            'timezone_value' => sprintf('%.1f', $timezone),
                                                            'timezone_abbr' => $timezone_abbr,   
                                                            'is_DST' => $isDST?'1':'0',
                                                            'location' => $event->location,
                                                            'description' => nl2br( $event->getDescription()),
                                                            'from_hour' => $from_hour,
                                                            'from_min' => $from_min,
                                                            'to_hour' => $to_hour,
                                                            'to_min' => $to_min,
                                                            'id' => $eId . '-r-' . $loop_interval,
                                                            'google_id' => $eId . '-r-' . $loop_interval,
                                                        );

                                                        $google_events[] = $new_event;    
                                                    }
                                                    
                                                }
                                                if ( $recurrence_by_weekdays ) {
                                                    $start_time_pos += 3600 * 24;
                                                    $end_time_pos += 3600 * 24;
                                                } else {
                                                    $start_time_pos += 3600 * 24 * 7;
                                                    $end_time_pos += 3600 * 24 * 7;
                                                }
                                                
                                                $loop_interval++;
                                                
                                            }
                                        // Monthly
                                        } else if ( $recurrence_freq == 'MONTHLY' ) {
                                            
                                            $recurrence_count = intval($recurrence_count/4);
                                            $start_date = new DateTime( date('Y-m-d H:i:s', $start_time) );
                                            $end_date = new DateTime( date('Y-m-d H:i:s', $end_time) );
                                            
                                            $start_time_pos = $start_time;
                                            $end_time_pos = $end_time;
                                            
                                            $loop_interval = 0;
                                            while ( $loop_interval < $recurrence_count ) {
                                                
                                                $is_deleted_recurring_event = 0;
                                                
                                                for ( $i = 0; $i < count($deleted_recurring_event); $i++) {
                                                    if( $deleted_recurring_event[$i] == $start_time_pos ) {
                                                        $is_deleted_recurring_event = 1;
                                                    }                                                                
                                                }
                                                
                                                if ( $current_time > $end_time_pos ) {
                                                    
                                                    $start_time_pos = strtotime($start_date->format('Y-m-d H:i:s'));
                                                    $end_time_pos = strtotime($end_date->format('Y-m-d H:i:s'));
                                                    
                                                    $days = cal_days_in_month(CAL_GREGORIAN, $start_date->format('n'), $start_date->format('Y'));
                                                    $start_date->add(new DateInterval('P' . $days .'D'));
                                                    $end_date->add(new DateInterval('P' . $days .'D'));
                                                    
                                                    continue;
                                                }
                                                
                                                if ( !$is_deleted_recurring_event ) {
                                                    $monthly_event = true;
                                                    
                                                    if ( $recurrence_interval ) {
                                                        if ( $loop_interval % $recurrence_interval != 0 )
                                                            $monthly_event = false;
                                                    }
                                                    
                                                    // Check available import
                                                    if ( !$this->checkAvailableImport($data['tab_id'], $eId . '-r-' . $loop_interval, $end_time_pos) ) {
                                                        $monthly_event = false;
                                                    }
                                                    
                                                    if ( $monthly_event ) {
                                                        if ( $event->getSummary() ) {
                                                            $new_event = array(
                                                                'name' => $event->getSummary(),
                                                                'start_date' => $start_time_pos,
                                                                'end_date' => $end_time_pos,
                                                                'timezone_value' => sprintf('%.1f', $timezone),
                                                                'timezone_abbr' => $timezone_abbr, 
                                                                'is_DST' => $isDST?'1':'0',
                                                                'location' => $event->location,
                                                                'description' => nl2br( $event->getDescription()),
                                                                'from_hour' => $from_hour,
                                                                'from_min' => $from_min,
                                                                'to_hour' => $to_hour,
                                                                'to_min' => $to_min,
                                                                'id' => $eId . '-r-' . $loop_interval,
                                                                'google_id' => $eId . '-r-' . $loop_interval,
                                                            );

                                                            $google_events[] = $new_event;    
                                                        }
                                                    }
                                                }
                                                $start_time_pos = strtotime($start_date->format('Y-m-d H:i:s'));
                                                $end_time_pos = strtotime($end_date->format('Y-m-d H:i:s'));
                                                
                                                $days = cal_days_in_month(CAL_GREGORIAN, $start_date->format('n'), $start_date->format('Y'));
                                                $start_date->add(new DateInterval('P' . $days .'D'));
                                                $end_date->add(new DateInterval('P' . $days .'D'));
                                                
                                                $loop_interval++;

                                            }
                                            
                                        }
                                        
                                    }
                                    date_default_timezone_set($default_timezone);
                                    
                                    
                                } else {
                                    
                                    // Check available import
                                    if ( !$this->checkAvailableImport($data['tab_id'], $eId, $end_time) ) {
                                        continue;
                                    }
                        
                                    // Fix description for the multiline
                                    if ( $event->getSummary() ) {
                                        $new_event = array(
                                            'name' => $event->getSummary(),
                                            'start_date' => $start_time,
                                            'end_date' => $end_time,
                                            'timezone_value' => sprintf('%.1f', $timezone),
                                            'timezone_abbr' => $timezone_abbr,
                                            'is_DST' => $isDST?'1':'0',
                                            'location' => $event->location,
                                            'description' => nl2br( $event->getDescription()),
                                            'from_hour' => $from_hour,
                                            'from_min' => $from_min,
                                            'to_hour' => $to_hour,
                                            'to_min' => $to_min,
                                            'id' => $eId,
                                            'google_id' => $eId,
                                        );

                                        $google_events[] = $new_event;    
                                    }
                                    
                                }
                                
                            }
                            
                            $pageToken = $events->getNextPageToken();
                            if ($pageToken) {
                                $optParams = array('pageToken' => $pageToken);
                                // $events = $google_service->events->listEvents('primary', $optParams);
                                $events = $google_service->events->listEvents($cal_id, $optParams);
                            } else {
                                $found = false; 
                            }
                        }
                    }
                            
                    $result['success'] = true;
                    $result['events'] = $google_events;
                    $result['total'] = count($google_events);
                    $result['google_token'] = $token;
                    $result['google_calendarId'] = $calendarId;
                    
                    /*
                    // Google sync calendar
                    $google_token = GoogleTokenModel::get_google_token($data['tab_id']);
                    if ( $google_token ) {
                        $google_token['last_sync'] = TimezoneModel::get_local_time($google_token['last_sync'], intval($this->app['timezone']));
                    } else {
                        $google_token = array(
                            'domain' => '',
                            'last_sync' => ''
                        );
                    }
                    $result['google_token'] = $google_token;
                    */
                    $this->ajax_response($result['success'], $result);
                    
                } catch ( Exception $e ) {
                    $result['error'] = $e->getMessage();
                }

            } else {
              $this->ajax_response(false, array(
                    "msg" => "Auth Needed",
                    "code" => '0',
                ));
            }
        
        } catch(Exception $e) {

            $this->ajax_response(false, array(
                "msg" => $this->phrases['build_desc_somethings_wrong'] . $e->getMessage(),
                "code" => '1'
            ));
            
        }

        // clear access token saved in session, in GoogleHelper.php
        
        $session_key = GoogleTokenModel::get_session_key();
        unset($_SESSION[$session_key]);
        
        
    }
    
    public function google_getDateAttr($fulldate) {
        // Example: 20160818T130000Z
        list($date, $time) = explode('T', $fulldate);
        
        return 
            substr($date, 0, 4) . '-' . 
            substr($date, 4, 2) . '-' . 
            substr($date, 6, 2);
    }
    
    public function google_weekday_number($weekday) {
        switch ( strtoupper($weekday) ) {
            case 'MO':
                $weekday = 1;
                break;
            case 'TU':
                $weekday = 2;
                break;
            case 'WE':
                $weekday = 3;
                break;
            case 'TH':
                $weekday = 4;
                break;
            case 'FR':
                $weekday = 5;
                break;
            case 'SA':
                $weekday = 6;
                break;
            default:
                $weekday = 0;
        }
        
        return $weekday;
    }

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
            $offset,
            $date
        );
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


}


