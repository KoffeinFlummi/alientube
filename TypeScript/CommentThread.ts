/// <reference path="index.ts" />
/**
    * Namespace for All AlienTube operations.
    * @namespace AlienTube
*/
module AlienTube {
    /**
        * Creates a new instance of a Comment Thread and adds it to DOM.
        * @class CommentThread
        * @param threadData JavaScript object containing all information about the Reddit thread.
        * @param commentSection The comment section object the thread exists within.
    */
    "use strict";
    export class CommentThread {
        commentSection: CommentSection;
        threadInformation: any;
        threadContainer: HTMLDivElement;

        private postIsInPreservedMode: Boolean;
        private commentData: Array<any>;
        private sortingTypes = [
            "confidence",
            "top",
            "new",
            "controversial",
            "old",
            "qa"
        ];
        public children: Array<any>;

        constructor(threadData: any, commentSection: CommentSection) {
            this.children = new Array();
            this.commentSection = commentSection;
            this.threadInformation = threadData[0].data.children[0].data;
            this.commentData = threadData[1].data.children;

            Preferences.set("redditUserIdentifierHash", threadData[0].data.modhash);
            this.postIsInPreservedMode = Utilities.isRedditPreservedPost(this.threadInformation);

            let template = Application.getExtensionTemplateItem(this.commentSection.template, "threadcontainer");
            this.threadContainer = <HTMLDivElement> template.querySelector("#at_comments");

            if (threadData[0].data.modhash.length > 0) {
                this.commentSection.userIsSignedIn = true;
                if (!threadData[0].data.modhash ||  !Preferences.getString("username")) {
                    new AlienTube.Reddit.RetreiveUsernameRequest();
                }
            } else {
                this.commentSection.userIsSignedIn = false;
                Preferences.set("username", "");
                this.threadContainer.classList.add("signedout");
            }

            /* Set the thread title and link to it, because Reddit for some reason encodes html entities in the title, we must use
            innerHTML. */
            let title = <HTMLParagraphElement> this.threadContainer.querySelector(".title");
            title.innerHTML = this.threadInformation.title;
            title.setAttribute("href", "http://reddit.com" + this.threadInformation.permalink);

            /* Set the username of the author and link to them */
            let username = this.threadContainer.querySelector(".at_author");
            username.textContent = this.threadInformation.author;
            username.setAttribute("href", "http://www.reddit.com/u/" + this.threadInformation.author);
            username.setAttribute("data-username", this.threadInformation.author);
            if (this.threadInformation.distinguished === "admin") {
                username.setAttribute("data-reddit-admin", "true");
            } else if (this.threadInformation.distinguished === "moderator") {
                username.setAttribute("data-reddit-mod", "true");
            }

            /* Add flair to the user */
            let flair = <HTMLSpanElement> this.threadContainer.querySelector(".at_flair");
            if (this.threadInformation.author_flair_text) {
                flair.textContent = this.threadInformation.author_flair_text;
            } else {
                flair.style.display = "none";
            }

            /* Set the NSFW label on the post if applicable */
            if (this.threadInformation.over_18) {
                let optionsElement = this.threadContainer.querySelector(".options");
                let nsfwElement = document.createElement("acronym");
                nsfwElement.classList.add("nsfw");
                nsfwElement.setAttribute("title", Application.localisationManager.get("post_badge_NSFW_message"));
                nsfwElement.textContent = Application.localisationManager.get("post_badge_NSFW");
                optionsElement.insertBefore(nsfwElement, optionsElement.firstChild);
            }

            /* Set the gild (how many times the user has been given gold for this post) if any */
            if (this.threadInformation.gilded) {
                let gildCountElement = this.threadContainer.querySelector(".at_gilded");
                gildCountElement.setAttribute("data-count", this.threadInformation.gilded);
            }

            /* Set the the thread posted time */
            let timestamp = this.threadContainer.querySelector(".at_timestamp");
            timestamp.textContent = Application.getHumanReadableTimestamp(this.threadInformation.created_utc);
            timestamp.setAttribute("timestamp", new Date(this.threadInformation.created_utc).toISOString());

            /* Set the localised text for "by {username}" */
            let submittedByUsernameText = this.threadContainer.querySelector(".templateSubmittedByUsernameText");
            submittedByUsernameText.textContent = Application.localisationManager.get("post_submitted_preposition");

            /* Set the text for the comments button  */
            let openNewCommentBox = this.threadContainer.querySelector(".commentTo");
            openNewCommentBox.textContent = this.threadInformation.num_comments + " " + Application.localisationManager.get("post_button_comments").toLowerCase();
            openNewCommentBox.addEventListener("click", this.onCommentButtonClick.bind(this), false);

            /* Set the button text and the event handler for the "save" button */
            let saveItemToRedditList = this.threadContainer.querySelector(".save");
            if (this.threadInformation.saved) {
                saveItemToRedditList.textContent = Application.localisationManager.get("post_button_unsave");
                saveItemToRedditList.setAttribute("saved", "true");
            } else {
                saveItemToRedditList.textContent = Application.localisationManager.get("post_button_save");
            }
            saveItemToRedditList.addEventListener("click", this.onSaveButtonClick.bind(this), false);


            /* Set the button text and the event handler for the "refresh" button */
            let refreshCommentThread = this.threadContainer.querySelector(".refresh");
            refreshCommentThread.addEventListener("click", function () {
                this.commentSection.threadCollection.forEach(function (item) {
                    if (item.id === this.threadInformation.id) {
                        this.commentSection.downloadThread(item);
                    }
                });
            }, false);
            refreshCommentThread.textContent = Application.localisationManager.get("post_button_refresh");

            /* Set the button text and the link for the "give gold" button */
            let giveGoldToUser = this.threadContainer.querySelector(".giveGold");
            giveGoldToUser.setAttribute("href", "http://www.reddit.com/gold?goldtype=gift&months=1&thing=" + this.threadInformation.name);
            giveGoldToUser.textContent = Application.localisationManager.get("post_button_gold");

            /* Set the button text and the event handler for the "report post" button */
            //let reportToAdministrators = this.threadContainer.querySelector(".report");
            //reportToAdministrators.textContent = Application.localisationManager.get("post_button_report");
            //reportToAdministrators.addEventListener("click", this.onReportButtonClicked.bind(this), false);

            /* Set the button text and event handler for the sort selector. */
            let sortController = <HTMLSelectElement> this.threadContainer.querySelector(".sort");
            for (var sortIndex = 0, sortLength = this.sortingTypes.length; sortIndex < sortLength; sortIndex += 1) {
                sortController.children[sortIndex].textContent = Application.localisationManager.get("post_sort_" + this.sortingTypes[sortIndex]);
            }
            sortController.selectedIndex = this.sortingTypes.indexOf(Preferences.getString("threadSortType"));
            sortController.addEventListener("change", function () {
                Preferences.set("threadSortType", sortController.children[sortController.selectedIndex].getAttribute("value"));

                (<any>this).commentSection.threadCollection.forEach(function (item) {
                    if (item.id === this.threadInformation.id) {
                        this.commentSection.downloadThread(item);
                    }
                });
            }, false);

            /* Set the state of the voting buttons */
            let voteController = <HTMLDivElement> this.threadContainer.querySelector(".vote");
            voteController.querySelector(".score").textContent = this.threadInformation.score;

            voteController.querySelector(".arrow.up").addEventListener("click", this.onUpvoteControllerClick.bind(this), false);
            voteController.querySelector(".arrow.down").addEventListener("click", this.onDownvoteControllerClick.bind(this), false);

            if (this.threadInformation.likes === true) {
                voteController.classList.add("liked");
            } else if (this.threadInformation.likes === false) {
                voteController.classList.add("disliked");
            }

            /* Set the icon, text, and event listener for the button to switch to the Google+ comments. */
            let googlePlusButton = <HTMLButtonElement> this.threadContainer.querySelector("#at_switchtogplus");
            googlePlusButton.addEventListener("click", this.onGooglePlusClick, false);

            let googlePlusContainer = <HTMLElement>document.querySelector("ytd-comments#comments > ytd-item-section-renderer");
            if (Preferences.getBoolean("showGooglePlusButton") === false ||  googlePlusContainer === null) {
                googlePlusButton.style.display = "none";
            }

            /* Mark the post as preserved if applicable */
            if (this.postIsInPreservedMode) {
                this.threadContainer.classList.add("preserved");
            } else {
                if (this.commentSection.userIsSignedIn) {
                    new CommentField(this);
                }
            }

            /* If this post is prioritised (official) mark it as such in the header */
            if (this.threadInformation.official) {
                let officialLabel = <HTMLSpanElement> this.threadContainer.querySelector(".at_official");
                officialLabel.textContent = Application.localisationManager.get("post_message_official");
                officialLabel.style.display = "inline-block";
            }

            /* Start iterating the top level comments in the comment section */
            this.commentData.forEach(function (commentObject) {
                if (commentObject.kind === "more") {
                    let readmore = new LoadMore(commentObject.data, this, this);
                    this.children.push(readmore);
                    this.threadContainer.appendChild(readmore.representedHTMLElement);
                } else {
                    let comment = new Comment(commentObject.data, this);
                    this.children.push(comment);
                    this.threadContainer.appendChild(comment.representedHTMLElement);
                }
            }.bind(this));

            this.set(this.threadContainer);
        }

        /**
        * Sets the contents of the comment thread.
        * @param contents HTML DOM node or element to use.
        */
        set(contents: Node) {
            let oldThread = document.getElementById("at_comments");
            let alientube = document.getElementById("alientube");
            if (alientube && oldThread) {
                alientube.removeChild(oldThread);
            }
            alientube.appendChild(contents);
        }
    	
        /**
         * Either save a post or unsave an already saved post.
         * @param eventObject The event object for the click of the save button.
         * @private
         */
        private onSaveButtonClick(eventObject: Event) {
            let saveButton = <HTMLSpanElement> eventObject.target;
            let savedType = saveButton.getAttribute("saved") ? AlienTube.Reddit.SaveType.UNSAVE : AlienTube.Reddit.SaveType.SAVE;
            new AlienTube.Reddit.SaveRequest(this.threadInformation.name, savedType, function () {
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
         * Show the report post form.
         * @param eventObject The event object for the click of the report button.
         * @private
         */
        private onReportButtonClicked(eventObject: Event) {
            new AlienTube.Reddit.Report(this.threadInformation.name, this, true);
        }
    	
        /**
         * Handle the click of the Google+ Button to change to the Google+ comments.
         * @private
         */
        private onGooglePlusClick(eventObject: Event) {
            let alienTubeContainer = document.getElementById("alientube");
            alienTubeContainer.style.display = "none";
            let googlePlusContainer = <HTMLElement>document.querySelector("ytd-comments#comments > ytd-item-section-renderer");
            googlePlusContainer.style.visibility = "visible";
            googlePlusContainer.style.height = "auto";
            let redditButton = <HTMLDivElement> document.getElementById("at_switchtoreddit");
            redditButton.style.display = "block";

            /* Terrible hack to force Google+ to reload the comments by making it think the user has resized the window.
               Having to do this makes me sad.  */
            document.body.style.width = document.body.offsetWidth + "px";
            window.getComputedStyle(document.body, null);
            document.body.style.width = "auto";
            window.getComputedStyle(document.body, null);
        }
        
        /**
         * Upvote a post or remove an existing upvote.
         * @param eventObject The event object for the click of the upvote button.
         * @private
         */
        private onUpvoteControllerClick(eventObject: Event) {
            let upvoteController = <HTMLDivElement> eventObject.target;
            let voteController = <HTMLDivElement> upvoteController.parentNode;
            let scoreValue = <HTMLDivElement> voteController.querySelector(".score");

            if (this.threadInformation.likes === true) {
                /* The user already likes this post, so they wish to remove their current like. */
                voteController.classList.remove("liked");
                this.threadInformation.likes = null;
                this.threadInformation.score = this.threadInformation.score - 1;
                scoreValue.textContent = this.threadInformation.score;

                new AlienTube.Reddit.VoteRequest(this.threadInformation.name, AlienTube.Reddit.Vote.REMOVE);
            } else {
                /* The user wishes to like this post */
                if (this.threadInformation.likes === false) {
                    /* The user has previously disliked this post, we need to remove that status and add 2 to the score instead of 1*/
                    voteController.classList.remove("disliked");
                    this.threadInformation.score = this.threadInformation.score + 2;
                } else {
                    this.threadInformation.score = this.threadInformation.score + 1;
                }
                voteController.classList.add("liked");
                this.threadInformation.likes = true;
                scoreValue.textContent = this.threadInformation.score;

                new AlienTube.Reddit.VoteRequest(this.threadInformation.name, AlienTube.Reddit.Vote.UPVOTE);
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
            let scoreValue = <HTMLDivElement> voteController.querySelector(".score");

            if (this.threadInformation.likes === false) {
                /* The user already dislikes this post, so they wish to remove their current dislike */
                voteController.classList.remove("disliked");
                this.threadInformation.likes = null;
                this.threadInformation.score = this.threadInformation.score + 1;
                scoreValue.textContent = this.threadInformation.score;

                new AlienTube.Reddit.VoteRequest(this.threadInformation.name, AlienTube.Reddit.Vote.REMOVE);
            } else {
                /* The user wishes to dislike this post */
                if (this.threadInformation.likes === true) {
                    /* The user has previously liked this post, we need to remove that status and subtract 2 from the score instead of 1*/
                    voteController.classList.remove("liked");
                    this.threadInformation.score = this.threadInformation.score - 2;
                } else {
                    this.threadInformation.score = this.threadInformation.score - 1;
                }
                voteController.classList.add("disliked");
                this.threadInformation.likes = false;
                scoreValue.textContent = this.threadInformation.score;

                new AlienTube.Reddit.VoteRequest(this.threadInformation.name, AlienTube.Reddit.Vote.DOWNVOTE);
            }
        }
    	
        /**
         * Handle the click of the "comment" button, to show or hide the post comment box.
         * @private
         */
        private onCommentButtonClick() {
            let header = document.querySelector(".at_thread");
            let previousCommentBox = header.querySelector(".at_commentfield");
            if (previousCommentBox) {
                previousCommentBox.parentNode.removeChild(previousCommentBox);
            }
            new CommentField(this);
        }
    }
}
