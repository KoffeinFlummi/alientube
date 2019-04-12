/// <reference path="../index.ts" />
/**
    * Namespace for requests to the Reddit API operations.
    * @namespace AlienTube.Reddit
*/
module AlienTube.Reddit {
    /**
        Perform a request to Reddit with embedded error handling.
        * @class Request
        * @param url The Reddit URL to make the request to.
        * @param type The type of request (POST or GET).
        * @param callback A callback handler for when the request is completed.
        * @param [postData] Eventual HTTP POST data to send with the request.
        * @param [loadingScreen] A LoadingScreen object to use for updating the progress of the request.
    */
    "use strict";
    export class Request {
        private requestUrl: string;
        private requestType: RequestType;
        private finalCallback: any;
        private postData: any;
        private loadingScreen: LoadingScreen;
        private attempts: number;

        private loadTimer = 0;
        private timeoutTimer = 0;

        constructor(url: string, type: RequestType, callback: any, postData?: any, loadingScreen?: LoadingScreen) {
            /* Move the request parameters so they are accessible from anywhere within the class. */
            this.requestUrl = url;
            this.requestType = type;
            this.finalCallback = callback;
            this.postData = postData;
            this.loadingScreen = loadingScreen;
            
            /* Perform the request. */
            this.performRequest();
        }
        
        /**
         * Attempt to perform the request to the Reddit API.
         */
        private performRequest() {
            this.attempts += 1;

            /* Kick of a 3 second timer that will confirm to the user that the loading process is taking unusually long, unless cancelled
            by a successful load (or an error) */
            this.loadTimer = setTimeout(function () {
                let loadingText = document.getElementById("at_loadingtext");
                loadingText.textContent = Application.localisationManager.get("loading_slow_message");
            }, 3000);

            /* Kick of a 30 second timer that will cancel the connection attempt and display an error to the user letting them know
            something is probably blocking the connection. */
            this.timeoutTimer = setTimeout(function () {
                new ErrorScreen(Application.commentSection, ErrorState.CONNECTERROR);
            }, 30000);

            /* Perform the reddit api request */
            chrome.runtime.sendMessage({requestType: "redditRequest", url: this.requestUrl, type: this.requestType, data: this.postData}, (response) => {
                if (response.success) {
                    this.onSuccess(response.content);
                } else {
                    this.onRequestError(response.status, response.content);
                }
            });
        }
    	
        /**
         * Called when a successful request has been made.
         * @param responseText the response from the Reddit API.
         */
        private onSuccess(responseText) {
            /* Cancel the slow load timer */
            clearTimeout(this.loadTimer);
            
            /* Cancel the unsuccessful load timer */
            clearTimeout(this.timeoutTimer);

            /* Dismiss the loading screen, perform the callback and clear ourselves out of memory. */
            this.loadingScreen.updateProgress(LoadingState.COMPLETE);
            try {
                let responseObject = JSON.parse(responseText);
                this.finalCallback(responseObject);
            } catch (e) {
                if (e.toString().indexOf("SyntaxError: Unexpected end of input") !== -1) {
                    new ErrorScreen(Application.commentSection, ErrorState.CONNECTERROR);
                } else {
                    new ErrorScreen(Application.commentSection, ErrorState.ERROR, e.stack);
                }
            }
        }
    	
        /**
         * Called when a request was unsuccessful.
         * @param xhr the javascript XHR object of the request.
         * @param [response] An optional error message.
         */
        private onRequestError(status, response?) {
            /* Cancel the slow load timer */
            clearTimeout(this.loadTimer);
            clearTimeout(this.timeoutTimer);

            if (this.attempts <= 3 && status !== 404) {
                /* Up to 3 attempts, retry the loading process automatically. */
                this.loadingScreen.updateProgress(LoadingState.RETRY);
                this.performRequest();
            } else {
                /* We have tried too many times without success, give up and display an error to the user. */
                this.loadingScreen.updateProgress(LoadingState.ERROR);
                switch (status) {
                    case 0:
                        new ErrorScreen(Application.commentSection, ErrorState.BLOCKED);
                        break;

                    case 404:
                        new ErrorScreen(Application.commentSection, ErrorState.NOT_FOUND);
                        break;

                    case 503:
                    case 504:
                    case 520:
                    case 521:
                        new ErrorScreen(Application.commentSection, ErrorState.OVERLOAD);
                        break;

                    default:
                        new ErrorScreen(Application.commentSection, ErrorState.REDDITERROR, response);
                }
            }
        }
    }
}
