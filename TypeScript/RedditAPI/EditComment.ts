/// <reference path="../index.ts" />
/**
    * Namespace for requests to the Reddit API operations.
    * @namespace AlienTube.Reddit
*/
module AlienTube.Reddit {
    /**
        Perform a request to Reddit to edit an existing comment.
        @class EditCommentRequest
        @param thing The Reddit ID of the item the user wants edit.
        @param comment A markdown string containing the user's new comment
        @param callback Callback handler for the event when loaded.
    */
    "use strict";
    export class EditCommentRequest {
        constructor(thing: string, comment: string, callback?: any) {
            let url = "https://api.reddit.com/api/editusertext";
            chrome.runtime.sendMessage({requestType: "redditRequest", url: url, type: RequestType.POST, data: {
                "uh": Preferences.getString("redditUserIdentifierHash"),
                "thing_id": thing,
                "text": comment,
                "api_type": "json"
            }}, (response) => {
                if (response.success) {
                    callback(response.content);
                }
            });
        }
    }
}
