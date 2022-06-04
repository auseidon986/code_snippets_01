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

class GooglePrinterController extends Controller {
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


        if ( $data["act"] == "on" ) {

            $google_client = GoogleHelper::getGoogleClient4Printer ($data['app_id'], $data['tab_id'], $data['is_partner'], $data['me']);

            if ( !$google_client->getAccessToken() ) {
                $auth = $google_client->createAuthUrl();
            }

            if ( isset($auth) ) {
                $REDIRECT_URL = $auth;

                header("location: " . $REDIRECT_URL);
                exit;

            } else {
                // Already auth is done, then go on
                
                header("location: " . $gp_auth["domain"] . '/v2/ajax.php?route=util.googlePrinter.google_auth_close');

                /*
                $this->layout = 'layouts.blank.layout';
                $this->render('tabs.orderingview.google_auth_done');
                */

            }
        } else {
            // Log out done
            $google_client = GoogleHelper::getGoogleClient4Printer ($data['app_id'], $data['tab_id'], $data['is_partner'], $data['me'], false, true);

            $this->ajax_response(true, array(
                'msg' => $this->phrases['build_desc_google_printer_disconnected'],
                'data' => array (),
            ));
            exit;
        }
        
    }

    public function google_auth_done() {

        $data = $_SESSION['gp_auth'];
        $google_client = GoogleHelper::getGoogleClient4Printer ($data['app_id'], $data['tab_id'], $data['is_partner'], $data['me'], $_REQUEST['code']);
        $_SESSION["gp_auth"] = array();

        // header("location: " . $data["domain"] . '/v2/ajax.php?route=util.googlePrinter.google_auth_close');

        $this->layout = 'layouts.blank.layout';
        $this->render('tabs.orderingview.google_auth_done');
        
    }

    public function google_auth_close() {

        $this->layout = 'layouts.blank.layout';
        $this->render('tabs.orderingview.google_auth_done');
    }

    public function google_get_printers() {

        $me = getMyInstance();
        $is_partner = is_partner();
        $google_printers = array();

        $data = $_REQUEST;
        if ($_SESSION['auth_user_id']) $data['app_id'] = $_SESSION['auth_user_id'];

        try {

            $google_client = GoogleHelper::getGoogleClient4Printer ($data['app_id'], $data['tab_id'], $is_partner, $me);
            if ($google_client->getAccessToken()) {
                try {
                    $req = new Google_Http_Request("http://www.google.com/cloudprint/search");
                    $req = $google_client->getAuth()->authenticatedRequest($req);
                    $val = $google_client->getIo()->executeRequest($req);

                    $response = json_decode($val[0]);

                    /*
                      object(stdClass)[7]
                      public 'success' => boolean true
                      public 'printers' =>
                        array
                          0 =>
                            object(stdClass)[8]
                              public 'id' => string '6eff62e1-738d-d0d9-7792-d14e8361e2e5' (length=36)
                              public 'name' => string 'Send To OneNote 2007' (length=20)
                              public 'displayName' => string 'Send To OneNote 2007' (length=20)
                              public 'defaultDisplayName' => string '' (length=0)
                              public 'description' => string '' (length=0)
                              public 'type' => string 'GOOGLE' (length=6)
                              public 'proxy' => string '3635c0be-1013-4884-9a23-22216fcffbf6' (length=36)
                              public 'status' => string '0' (length=1)
                              public 'isTosAccepted' => boolean false
                              public 'capsHash' => string '833ed1018795180451c960f16222a56f' (length=32)
                              public 'createTime' => string '1333947504846' (length=13)
                              public 'updateTime' => string '1333947612217' (length=13)
                              public 'accessTime' => string '1333947504846' (length=13)
                              public 'numberOfDocuments' => string '1' (length=1)
                              public 'numberOfPages' => string '1' (length=1)
                              public 'tags' =>
                                array
                                  ...
                    */

                    if($response->success) {
                        foreach($response->printers AS $pr) {
                            if($pr->status != "") {
                                $google_printers[] = array(
                                    "id" => $pr->id,
                                    "name" => $pr->name,
                                    // "display_name" => $pr->displayName,
                                    "proxy" => $pr->proxy,
                                );
                            }
                        }
                    }

                    $return_data = array(
                        "data" => array(
                            "printers" => $google_printers
                        )
                    );
                    $this->ajax_response(true, $return_data);

                } catch(Google_AuthException $e) {
                    $this->ajax_response(false, array(
                        "msg" => $this->phrases['build_desc_auth_needed'],
                        "code" => '0',

                    ));
                }
            } else {
              $this->ajax_response(false, array(
                    "msg" => $this->phrases['build_desc_auth_needed'],
                    "code" => '0',

                ));
            }
        
        } catch(Exception $e) {

            $this->ajax_response(false, array(
                "msg" => $this->phrases['build_desc_somethings_wrong'],
                "code" => '1',

            ));
        }
        
        
    }


}


