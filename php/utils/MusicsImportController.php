<?php
/**
 * MusicImportController.php
 *
 * This class supports the controller for music tab.
 *
 * @author Austin L <auslee986@gmail.com>
 * @version 1.0
 */


BLoader::import('appTabs');
BLoader::import_helper('request, image, array');

class MusicsImportController extends Controller {
	/**
	 * Constructor.
	 */
	public function __construct($opts)
	{
        parent::__construct($opts);

        $this->rules = array(
            '*' => 'auth.client_loggedin'
        );

	}


    function get_7() { // get 7digital import


        $data = RequestHelper::get_safe_data($_REQUEST);

        $search_url = "http://api.7digital.com/1.2/track/search?q=" . urlencode($data["k"]) . "&country=" . urlencode($data["c"]) . "&oauth_consumer_key=7dpg55n55qgn&pageSize=50";
        $xmls = SecureHelper::_file_get_contents($search_url);
        
        
        $songs = ArrayHelper::xml2array($xmls);
        $songs = $songs["response"]["searchResults"]["searchResult"];

        $musics = array();

        if(is_array($songs) && count($songs > 0)) {
            
            foreach($songs AS $song) {
                
                $music = array(
                    'id' => $song["track_attr"]["id"],
                    'artist' => $song["track"]["artist"]["name"],
                    'title' => $song["track"]["title"],
                    'duration' => $song["track"]["duration"],
                    'album' => $song["track"]["release"]["title"],
                    'itune_url' => $song["track"]["release"]["url"],
                    'thumb_url' => $song["track"]["release"]["image"],
                    'track' => '', // Preview is not available for permanent access
                ); 

                $musics[] = $music;

            }       
        }


        $result = array(
            'success' => true,
            'error' => '',
            'musics' => $musics,
        );

        $this->ajax_response($result['success'], $result);
    }

    function get_i() { // get itunes import


        $result = array(
            'success' => true,
            'error' => '',
            'musics' => array(),
        );
        $musics = array();

        $data = RequestHelper::get_safe_data($_REQUEST);
        $isInvalid = false;

        if($data["t"] == "s" ) { // Search
            $song_url = "http://itunes.apple.com/search?term=".urlencode($data[k])."&media=music&entity=song&country=" . $data[c];
        } else if($data["t"] == "a" ) { // Album
            
            $url = $data["u"];
            $url = explode("&", $url, 2);
            $url = $url[0];
            $url = explode("?", $url, 2);
            $url = $url[0];
            
            // Check URL
            if(preg_match("/(id)(.*)$/", $url, $matches)) {
                $album_id = substr($matches[0], 2);
                $song_url = "http://itunes.apple.com/lookup?id=".$album_id."&entity=song";  
            } else {
                $isInvalid = true;    

                $result['success'] = false;
                $result['error'] = $this->phrases['build_desc_wrong_album_url'];
            }
            
        }

        
        if($isInvalid == false) {
            $songs = json_decode($this->getOnlineJSON($song_url));

            if($songs->resultCount == "0") {
                
            } else  if($songs->errorMessage != "") {
                
                $result['success'] = false;
                $result['error'] = $songs->errorMessage;

            } else {

                $song_count = $songs->resultCount; 
                $songs = $songs->results;
                
                $startIndex = 0;
                if($data["t"] == "album" ) {
                    $startIndex = 1;
                }
            
                for($i = $startIndex; $i < $song_count; $i++) {
                    
                    if ($songs[$i]->previewUrl) {

                        $music = array(
                            'id' => $songs[$i]->trackId,
                            'artist' => $songs[$i]->artistName,
                            'title' => $songs[$i]->trackCensoredName,
                            'duration' => '' . round( intval($songs[$i]->trackTimeMillis) / 1000 ),
                            'album' => $songs[$i]->collectionName,
                            'itune_url' => $songs[$i]->trackViewUrl,
                            'thumb_url' => str_replace('100x100', '400x400', $songs[$i]->artworkUrl100), // url sample: http://is4.mzstatic.com/image/thumb/Music1/v4/bc/95/c0/bc95c024-d88e-c1ef-0013-5a787ff70655/dj.gxcluzto.jpg/100x100bb-85.jpg
                            'track' => $songs[$i]->previewUrl,
                        ); 

                        $musics[] = $music;
                    }

                } 

                $result['musics'] = $musics;
            }
        }

        $this->ajax_response($result['success'], $result);
    }


    private function getOnlineJSON($song_url) {
        // -----------------------------------------------
        // Create context
        // -----------------------------------------------
        $opts = array(
          'http'=>array(
            'method'=>"GET",
            'header'=>"User-Agent:Mozilla/5.0 (Windows NT 6.1) AppleWebKit/535.1 (KHTML, like Gecko) Chrome/14.0.835.186 Safari/535.1"
          )
        );
        
        $another_opts = array(
            'http'=>array(
                'method'=>"GET",
                'header'=>"
                    Accept:text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
                    Accept-Charset:ISO-8859-1,utf-8;q=0.7,*;q=0.3
                    User-Agent:Mozilla/5.0 (Windows NT 6.1) AppleWebKit/535.1 (KHTML, like Gecko) Chrome/14.0.835.186 Safari/535.1"
              )
        );
        
        // -----------------------------------------------
        // Read RSS from the source
        // -----------------------------------------------
        
        $context = SecureHelper::_stream_context_create($opts);
        $songs = SecureHelper::_file_get_contents($song_url, false, $context);
        if($songs == "") {
            $context = SecureHelper::_stream_context_create($another_opts);
            $songs = SecureHelper::_file_get_contents($song_url, false, $context);
        }
        
        return $songs;
    }



    function prepare_music() { // prepare event in Event Brite for BA

       
    }

    

}


