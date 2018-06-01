/// <reference path="index.ts" />
/**
    * Namespace for All AlienTube operations.
    * @namespace AlienTube
*/
module AlienTube {
    /**
        * A class representation and container of a single Reddit comment.
        * @class ReadMore
        * @param data Object containing the "load more comments" links.
        * @param commentThread CommentThread object representing the container of the load more link.
    */
    "use strict";
    export class LoadMore {
        representedHTMLElement: HTMLDivElement;
        private data: any;
        private commentThread;
        private referenceParent;

        constructor(data: any, referenceParent: any, commentThread: CommentThread) {
            this.data = data;
            this.commentThread = commentThread;
            this.referenceParent = referenceParent;

            this.representedHTMLElement = Application.getExtensionTemplateItem(commentThread.commentSection.template, "loadmore");

            /* Display the amount of replies available to load */
            let replyCount = this.representedHTMLElement.querySelector(".at_replycount");
            let replyCountText = data.count > 1 ? Application.localisationManager.get("post_label_reply_plural") : Application.localisationManager.get("post_label_reply");
            replyCount.textContent = "(" + data.count + " " + replyCountText + ")";

            /* Set the localisation for the "load more" button, and the event listener. */
            let loadMoreText = this.representedHTMLElement.querySelector(".at_load");
            loadMoreText.textContent = Application.localisationManager.get("post_button_load_more");
            loadMoreText.addEventListener("click", this.onLoadMoreClick.bind(this), false);
        }
    	
        /**
         * Handle a click on the "load more" button.
         * @param eventObject The event object of the load more button click.
         * @private
         */
        private onLoadMoreClick(eventObject: Event) {
            /* Display "loading comments" text */
            let loadingText = <HTMLAnchorElement> eventObject.target;
            loadingText.classList.add("loading");
            loadingText.textContent = Application.localisationManager.get("loading_generic_message");

            let generateRequestUrl = `https://api.reddit.com/r/${this.commentThread.threadInformation.subreddit}/comments/${this.commentThread.threadInformation.id}/z/${this.data.id}.json`;

            new HttpRequest(generateRequestUrl, RequestType.GET, function (responseData) {
                /* Remove "loading comments" text */
                let getParentNode = loadingText.parentNode.parentNode;
                getParentNode.removeChild(loadingText.parentNode);

                /* Traverse the retrieved comments and append them to the comment section */
                let commentItems = JSON.parse(responseData)[1].data.children;
                if (commentItems.length > 0) {
                    commentItems.forEach(function (commentObject) {
                        var readmore, comment;
                        if (commentObject.kind === "more") {
                            readmore = new LoadMore(commentObject.data, this.referenceParent, this.commentThread);
                            this.referenceParent.children.push(readmore);
                            getParentNode.appendChild(readmore.representedHTMLElement);
                        } else {
                            comment = new Comment(commentObject.data, this.commentThread);
                            this.referenceParent.children.push(comment);
                            getParentNode.appendChild(comment.representedHTMLElement);
                        }
                    }.bind(this));
                }
            }.bind(this));
        }
    }
}
