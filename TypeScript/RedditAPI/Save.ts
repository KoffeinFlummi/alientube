/// <reference path="../index.ts" />
/**
    * Namespace for requests to the Reddit API operations.
    * @namespace AlienTube.Reddit
*/
module AlienTube.Reddit {
    /**
        Perform a request to Reddit to either save or unsave an item.
        @class RedditSaveRequest
        @param thing The Reddit ID of the item to either save or unsave
        @param type Whether to save or unsave
        @param callback Callback handler for the event when loaded.
    */
    "use strict";
    export class SaveRequest {
        constructor(thing: string, type: SaveType, callback: any) {
            let url = "https://api.reddit.com/api/" + SaveType[type].toLowerCase();
            chrome.runtime.sendMessage({requestType: "redditRequest", url: url, type: RequestType.POST, data: {
                "uh": Preferences.getString("redditUserIdentifierHash"),
                "id": thing
            }}, (response) => {
                if (response.success) {
                    callback(response.content);
                }
            });
        }
    }

    export enum SaveType {
        SAVE,
        UNSAVE
    }
}
