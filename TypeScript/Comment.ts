/// <reference path="index.ts" />
/**
    * Namespace for All AlienTube operations.
    * @namespace AlienTube
*/
module AlienTube {
    /**
        * A class representation and container of a single Reddit comment.
        * @class Comment
        * @param commentData Object containing the comment data from the Reddit API.
        * @param commentThread CommentThread object representing the container of the comment.
    */
    "use strict";
    export class Comment {
        representedHTMLElement: HTMLDivElement;
        commentObject: any;
        children: Array<any>;
        private commentThread: CommentThread;

        constructor(commentData: any, commentThread: CommentThread) {
            this.children = new Array();
            this.commentObject = commentData;
            this.commentThread = commentThread;
            var template = Application.getExtensionTemplateItem(this.commentThread.commentSection.template, "comment");

            this.representedHTMLElement = <HTMLDivElement> template.querySelector(".at_comment");

            /* Set the id for the comment in question so it can be correlated with the Comment Object */
            this.representedHTMLElement.setAttribute("data-reddit-id", commentData.id);

            /* Show / collapse function for the comment */
            let toggleHide = this.representedHTMLElement.querySelector(".at_togglehide");
            toggleHide.addEventListener("click", function() {
                this.representedHTMLElement.classList.toggle("minimized");
            }.bind(this), false);

            /* Hide comments with a score less than the threshold set by the user  */
            if (this.commentObject.score < Preferences.getNumber("hiddenCommentScoreThreshold")) {
                this.representedHTMLElement.classList.add("minimized");
            }

            /* Set the link and name of author, as well as whether they are the OP or not. */
            let author = this.representedHTMLElement.querySelector(".at_author");
            author.textContent = this.commentObject.author;
            author.setAttribute("href", "http://reddit.com/u/" + this.commentObject.author);
            author.setAttribute("data-username", this.commentObject.author);
            if (commentData.distinguished === "admin") {
                author.setAttribute("data-reddit-admin", "true");
            } else if (commentData.distinguished === "moderator") {
                author.setAttribute("data-reddit-mod", "true");
            } else if (commentData.author === commentThread.threadInformation.author) {
                author.setAttribute("data-reddit-op", "true");
            }

            /* Set the gild (how many times the user has been given gold for this post) if any */
            if (this.commentObject.gilded) {
                this.representedHTMLElement.querySelector(".at_gilded").setAttribute("data-count", this.commentObject.gilded);
            }

            /* Add flair to the user */
            let flair = <HTMLSpanElement> this.representedHTMLElement.querySelector(".at_flair");
            if (this.commentObject.author_flair_text) {
                flair.textContent = this.commentObject.author_flair_text;
            } else {
                flair.style.display = "none";
            }

            /* Set the score of the comment next to the user tag */
            let score = <HTMLSpanElement> this.representedHTMLElement.querySelector(".at_score");
            let scorePointsText = this.commentObject.score === 1 ? Application.localisationManager.get("post_current_score") : Application.localisationManager.get("post_current_score_plural");
            score.textContent = (this.commentObject.score + scorePointsText);

            /* Set the timestamp of the comment */
            let timestamp = <HTMLSpanElement> this.representedHTMLElement.querySelector(".at_timestamp");
            timestamp.textContent = Application.getHumanReadableTimestamp(this.commentObject.created_utc);
            timestamp.setAttribute("timestamp", new Date(this.commentObject.created_utc).toISOString());
            
            /* If the post has been edited, display the edit time next to the timestamp. */
            if (this.commentObject.edited) {
                timestamp.classList.add("edited");
                timestamp.title = `${Application.getHumanReadableTimestamp(this.commentObject.edited, "edited_timestamp_format")}`;
            }

            /* Render the markdown and set the actual comement messsage of the comment */
            let contentTextOfComment = this.representedHTMLElement.querySelector(".at_commentcontent");
            let contentTextHolder = document.createElement("span");

            /* Terrible workaround: Reddit text is double encoded with html entities for some reason, so we have to insert it into the DOM
            twice to make the browser decode it. */
            let textParsingElement = document.createElement("span");
            textParsingElement.innerHTML = this.commentObject.body;

            /* Set the comment text */
            contentTextHolder.innerHTML = SnuOwnd.getParser().render(textParsingElement.textContent);
            contentTextOfComment.appendChild(contentTextHolder);
            if (this.commentObject.body === "[deleted]") {
                this.representedHTMLElement.classList.add("deleted");
            }

            /* Set the button text and event handler for the reply button. */
            let replyToComment = this.representedHTMLElement.querySelector(".at_reply");
            replyToComment.textContent = Application.localisationManager.get("post_button_reply");
            replyToComment.addEventListener("click", this.onCommentButtonClick.bind(this), false);

            /* Set the button text and link for the "permalink" button */
            let permalinkElement = this.representedHTMLElement.querySelector(".at_permalink");
            permalinkElement.textContent = Application.localisationManager.get("post_button_permalink");
            permalinkElement.setAttribute("href", `http://www.reddit.com${commentThread.threadInformation.permalink}${this.commentObject.id}`);

            /* Set the button text and link for the "parent" link button */
            let parentLinkElement = this.representedHTMLElement.querySelector(".at_parentlink");
            parentLinkElement.textContent = Application.localisationManager.get("post_button_parent");
            parentLinkElement.setAttribute("href", `http://www.reddit.com${commentThread.threadInformation.permalink}#${this.commentObject.parent_id.substring(3)}`);

            /* Set the button text and the event handler for the "show source" button */
            let displaySourceForComment = this.representedHTMLElement.querySelector(".at_displaysource");
            displaySourceForComment.textContent = Application.localisationManager.get("post_button_source");
            displaySourceForComment.addEventListener("click", this.onSourceButtonClick.bind(this), false);

            /* Set the button text and the event handler for the "save comment" button */
            let saveItemToRedditList = this.representedHTMLElement.querySelector(".save");
            if (this.commentObject.saved) {
                saveItemToRedditList.textContent = Application.localisationManager.get("post_button_unsave");
                saveItemToRedditList.setAttribute("saved", "true");
            } else {
                saveItemToRedditList.textContent = Application.localisationManager.get("post_button_save");
            }
            saveItemToRedditList.addEventListener("click", this.onSaveButtonClick.bind(this), false);

            /* Set the button text and the link for the "give gold" button */
            let giveGoldToUser = this.representedHTMLElement.querySelector(".giveGold");
            giveGoldToUser.setAttribute("href", "http://www.reddit.com/gold?goldtype=gift&months=1&thing=" + this.commentObject.name);
            giveGoldToUser.textContent = Application.localisationManager.get("post_button_gold");

            //let reportToAdministrators = this.representedHTMLElement.querySelector(".report");
            let editPost = this.representedHTMLElement.querySelector(".at_edit");
            let deletePost = this.representedHTMLElement.querySelector(".at_delete");
            if (this.commentObject.author === Preferences.getString("username")) {
                /* Report button does not make sense on our own post, so let's get rid of it */
                //reportToAdministrators.parentNode.removeChild(reportToAdministrators);

                /* Set the button text and the event handler for the "edit post" button */
                editPost.textContent = Application.localisationManager.get("post_button_edit");
                editPost.addEventListener("click", this.onEditPostButtonClick.bind(this), false);

                /* Set the button text and the event handler for the "delete post" button */
                deletePost.textContent = Application.localisationManager.get("post_button_delete");
                deletePost.addEventListener("click", this.onDeletePostButtonClick.bind(this), false);
            } else {
                /* Delete and edit buttons does not make sense if the post is not ours, so let's get rid of them. */
                editPost.parentNode.removeChild(editPost);
                deletePost.parentNode.removeChild(deletePost);

                /* Set the button text and the event handler for the "report comment" button */
                //reportToAdministrators.textContent = Application.localisationManager.get("post_button_report");
                //reportToAdministrators.addEventListener("click", this.onReportButtonClicked.bind(this), false);
            }

            /* Set the state of the voting buttons */
            let voteController = <HTMLDivElement> this.representedHTMLElement.querySelector(".vote");
            voteController.querySelector(".arrow.up").addEventListener("click", this.onUpvoteControllerClick.bind(this), false);
            voteController.querySelector(".arrow.down").addEventListener("click", this.onDownvoteControllerClick.bind(this), false);
            if (this.commentObject.likes === true) {
                voteController.classList.add("liked");
            } else if (this.commentObject.likes === false) {
                voteController.classList.add("disliked");
            }

            /* Continue traversing down and populate the replies to this comment. */
            if (this.commentObject.replies) {
                let replyContainer = this.representedHTMLElement.querySelector(".at_replies");
                this.commentObject.replies.data.children.forEach(function (commentObject) {
                    if (commentObject.kind === "more") {
                        let readmore = new LoadMore(commentObject.data, this, commentThread);
                        this.children.push(readmore);
                        replyContainer.appendChild(readmore.representedHTMLElement);
                    } else {
                        let comment = new Comment(commentObject.data, commentThread);
                        this.children.push(comment);
                        replyContainer.appendChild(comment.representedHTMLElement);
                    }
                }.bind(this));
            }
        }
    	
        /**
         * Either save a comment or unsave an already saved comment.
         * @param eventObject The event object for the click of the save button.
         * @private
         */
        private onSaveButtonClick(eventObject: Event) {
            let saveButton = <HTMLSpanElement> eventObject.target;
            let savedType = saveButton.getAttribute("saved") ? AlienTube.Reddit.SaveType.UNSAVE : AlienTube.Reddit.SaveType.SAVE;
            new AlienTube.Reddit.SaveRequest(this.commentObject.name, savedType, function () {
                if (savedType === AlienTube.Reddit.SaveType.SAVE) {
                    saveButton.setAttribute("saved", "true");
                    saveButton.textContent = Application.localisationManager.get("post_button_unsave");
                } else {
                    saveButton.removeAttribute("saved");
                    saveButton.textContent = Application.localisationManager.get("post_button_save");
                }
            });
        }
        
        /**
         * Show the report comment form.
         * @param eventObject The event object for the click of the report button.
         * @private
         */
        private onReportButtonClicked(eventObject: Event) {
            new AlienTube.Reddit.Report(this.commentObject.name, this.commentThread, false);
        }
        
        /**
         * Upvote a comment or remove an existing upvote.
         * @param eventObject The event object for the click of the upvote button.
         * @private
         */
        private onUpvoteControllerClick(eventObject: Event) {
            let upvoteController = <HTMLDivElement> eventObject.target;
            let voteController = <HTMLDivElement> upvoteController.parentNode;
            let parentNode = <HTMLDivElement> voteController.parentNode;
            let scoreValue = <HTMLSpanElement> parentNode.querySelector(".at_score");

            if (this.commentObject.likes === true) {
                /* The user already likes this post, so they wish to remove their current like. */
                voteController.classList.remove("liked");
                this.commentObject.likes = null;
                this.commentObject.score = this.commentObject.score - 1;
                let scorePointsText = this.commentObject.score === 1 ? Application.localisationManager.get("post_current_score") : Application.localisationManager.get("post_current_score_plural");
                scoreValue.textContent = this.commentObject.score + scorePointsText;

                new AlienTube.Reddit.VoteRequest(this.commentObject.name, AlienTube.Reddit.Vote.REMOVE);
            } else {
                /* The user wishes to like this post */
                if (this.commentObject.likes === false) {
                    /* The user has previously disliked this post, we need to remove that status and add 2 to the score instead of 1*/
                    voteController.classList.remove("disliked");
                    this.commentObject.score = this.commentObject.score + 2;
                } else {
                    this.commentObject.score = this.commentObject.score + 1;
                }
                voteController.classList.add("liked");
                this.commentObject.likes = true;
                let scorePointsText = this.commentObject.score === 1 ? Application.localisationManager.get("post_current_score") : Application.localisationManager.get("post_current_score_plural");
                scoreValue.textContent = this.commentObject.score + scorePointsText;

                new AlienTube.Reddit.VoteRequest(this.commentObject.name, AlienTube.Reddit.Vote.UPVOTE);
            }
        }
    	
        /**
         * Downvote a comment or remove an existing downvote
         * @param eventObject The event object for the click of the downvote button.
         * @private
         */
        private onDownvoteControllerClick(eventObject: Event) {
            let downvoteController = <HTMLDivElement> eventObject.target;
            let voteController = <HTMLDivElement> downvoteController.parentNode;
            let parentNode = <HTMLDivElement> voteController.parentNode;
            let scoreValue = <HTMLSpanElement> parentNode.querySelector(".at_score");

            if (this.commentObject.likes === false) {
                /* The user already dislikes this post, so they wish to remove their current dislike */
                voteController.classList.remove("disliked");
                this.commentObject.likes = null;
                this.commentObject.score = this.commentObject.score + 1;
                let scorePointsText = this.commentObject.score === 1 ? Application.localisationManager.get("post_current_score") : Application.localisationManager.get("post_current_score_plural");
                scoreValue.textContent = this.commentObject.score + scorePointsText;

                new AlienTube.Reddit.VoteRequest(this.commentObject.name, AlienTube.Reddit.Vote.REMOVE);
            } else {
                /* The user wishes to dislike this post */
                if (this.commentObject.likes === true) {
                    /* The user has previously liked this post, we need to remove that status and subtract 2 from the score instead of 1*/
                    voteController.classList.remove("liked");
                    this.commentObject.score = this.commentObject.score - 2;
                } else {
                    this.commentObject.score = this.commentObject.score - 1;
                }
                voteController.classList.add("disliked");
                this.commentObject.likes = false;
                let scorePointsText = this.commentObject.score === 1 ? Application.localisationManager.get("post_current_score") : Application.localisationManager.get("post_current_score_plural");
                scoreValue.textContent = this.commentObject.score + scorePointsText;

                new AlienTube.Reddit.VoteRequest(this.commentObject.name, AlienTube.Reddit.Vote.DOWNVOTE);
            }
        }

        /**
         * Show or hide the comment/reply box. 
         * @private
         */
        private onCommentButtonClick() {
            let previousCommentBox = this.representedHTMLElement.querySelector(".at_commentfield");
            if (previousCommentBox) {
                previousCommentBox.parentNode.removeChild(previousCommentBox);
            }
            new CommentField(this);
        }
    	
        /**
         * Show the source of the comment.
         * @private
         */
        private onSourceButtonClick() {
            let previousCommentBox = this.representedHTMLElement.querySelector(".at_commentfield");
            if (previousCommentBox) {
                previousCommentBox.parentNode.removeChild(previousCommentBox);
            }
            new CommentField(this, this.commentObject.body);
        }
    	
        /**
         * Edit a comment.
         * @private
         */
        private onEditPostButtonClick() {
            let previousCommentBox = this.representedHTMLElement.querySelector(".at_commentfield");
            if (previousCommentBox) {
                previousCommentBox.parentNode.removeChild(previousCommentBox);
            }
            new CommentField(this, this.commentObject.body, true);
        }
    	
        /**
         * Delete a comment.
         * @private
         */
        private onDeletePostButtonClick() {
            let confirmation = window.confirm(Application.localisationManager.get("post_delete_confirm"));
            if (confirmation) {
                var url = "https://api.reddit.com/api/del";
                new HttpRequest(url, RequestType.POST, function () {
                    this.representedHTMLElement.parentNode.removeChild(this.representedHTMLElement);
                    let getIndexInParentList = this.commentThread.children.indexOf(this);
                    if (getIndexInParentList !== -1) {
                        this.commentThread.children.splice(getIndexInParentList, 1);
                    }
                }, {
                        "uh": Preferences.getString("redditUserIdentifierHash"),
                        "id": this.commentObject.name,
                    });
            }
        }
    }
}
