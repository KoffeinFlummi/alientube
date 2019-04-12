/// <reference path="../index.ts" />
/**
    * Namespace for requests to the Reddit API operations.
    * @namespace AlienTube.Reddit
*/
module AlienTube.Reddit {
    /**
        Perform a request to Reddit asking for the user's username so we can save and display it.
        @class RetreiveUsernameRequest
    */
    "use strict";
    export class RetreiveUsernameRequest {
        constructor() {
            let url = "https://api.reddit.com/api/me.json";
            chrome.runtime.sendMessage({requestType: "redditRequest", url: url, type: RequestType.GET}, (response) => {
                if (response.success) {
                    let responseData = JSON.parse(response.content);
                    Preferences.set("username", responseData.data.name);

                    /* If possible we should set the username retroactively so the user doesn't need to reload the page */
                    let usernameField = document.querySelector(".at_writingauthor");
                    if (usernameField) {
                        usernameField.textContent = Application.localisationManager.get("commentfield_label_author", [Preferences.getString("username")]);
                    }
                }
            });
        }
    }
}
