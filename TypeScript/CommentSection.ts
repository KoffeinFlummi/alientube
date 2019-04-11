/// <reference path="index.ts" />
/**
    * Namespace for All AlienTube operations.
    * @namespace AlienTube
*/
module AlienTube {
    /**
        * Starts a new instance of the AlienTube comment section and adds it to DOM.
        * @class CommentSection
        * @param currentVideoIdentifier YouTube Video query identifier.
    */
    "use strict";
    export class CommentSection {
        template: HTMLDocument;
        threadCollection: Array<any>;
        storedTabCollection: Array<any>;
        userIsSignedIn: boolean;

        constructor(currentVideoIdentifier: string) {
            this.threadCollection = new Array();
            this.storedTabCollection = new Array();

            // Make sure video identifier is not null. If it is null we are not on a video page so we will just time out.
            if (currentVideoIdentifier) {
                // Load the html5 template file from disk and wait for it to load.
                let templateLink = document.createElement("link");
                templateLink.id = "alientubeTemplate";
                Application.getExtensionTemplates(function (templateContainer) {
                    this.template = templateContainer;

                    // Set Loading Screen
                    let loadingScreen = new LoadingScreen(this, LoadingState.LOADING, Application.localisationManager.get("loading_search_message"));
                    this.set(loadingScreen.HTMLElement);
                    // Open a search request to Reddit for the video identfiier
                    let videoSearchString = this.getVideoSearchString(currentVideoIdentifier);
                    new AlienTube.Reddit.Request("https://api.reddit.com/search.json?q=" + videoSearchString, RequestType.GET, function (results) {

                        // There are a number of ways the Reddit API can arbitrarily explode, here are some of them.
                        if (results === {} || results.kind !== 'Listing' || results.data.children.length === 0) {
                            this.returnNoResults();
                        } else {
                            let searchResults = results.data.children;
                            let finalResultCollection = [];

                            /* Filter out Reddit threads that do not lead to the video. Additionally, remove ones that have passed the 6
                            month threshold for Reddit posts and are in preserved mode, but does not have any comments. */
                            searchResults.forEach(function(result) {
                                if (CommentSection.validateItemFromResultSet(result.data, currentVideoIdentifier)) {
                                    finalResultCollection.push(result.data);
                                }
                            });

                            let preferredPost, preferredSubreddit;
                            if (finalResultCollection.length > 0) {
                                if (Application.currentMediaService() === Service.YouTube) {
                                    /* Scan the YouTube comment sections for references to subreddits or reddit threads.
                                    These will be prioritised and loaded first.  */
                                    let mRegex = /(?:http|https):\/\/(.[^/]+)\/r\/([A-Za-z0-9][A-Za-z0-9_]{2,20})(?:\/comments\/)?([A-Za-z0-9]*)/g;

                                    let commentLinks = document.querySelectorAll("#eow-description a");
                                    for (var b = 0, coLen = commentLinks.length; b < coLen; b += 1) {
                                        let linkElement = <HTMLElement>commentLinks[b];
                                        let url = linkElement.getAttribute("href");
                                        if (typeof (url) !== 'undefined') {
                                            let match = mRegex.exec(url);
                                            if (match) {
                                                preferredSubreddit = match[2];
                                                if (match[3].length > 0) preferredPost = match[3];
                                                break;
                                            }
                                        }
                                    }
                                }

                                // Sort threads into array groups by what subreddit they are in.
                                let getExcludedSubreddits = Preferences.enforcedExludedSubreddits.concat(Preferences.getArray("excludedSubredditsSelectedByUser"));
                                let sortedResultCollection = {};
                                finalResultCollection.forEach(function(thread) {
                                    if (getExcludedSubreddits.indexOf(thread.subreddit.toLowerCase()) !== -1) return;
                                    if (thread.score < Preferences.getNumber("hiddenPostScoreThreshold")) return;

                                    if (!sortedResultCollection.hasOwnProperty(thread.subreddit)) sortedResultCollection[thread.subreddit] = [];
                                    sortedResultCollection[thread.subreddit].push(thread);
                                });

                                // Sort posts into collections by what subreddit they appear in.
                                this.threadCollection = [];
                                for (let subreddit in sortedResultCollection) {
                                    if (sortedResultCollection.hasOwnProperty(subreddit)) {
                                        this.threadCollection.push(sortedResultCollection[subreddit].reduce(function (a, b) {
                                            return ((this.getConfidenceForRedditThread(b) - this.getConfidenceForRedditThread(a)) || b.id === preferredPost) ? a : b;
                                        }.bind(this)));
                                    }
                                }

                                if (this.threadCollection.length > 0) {
                                    // Sort subreddits so there is only one post per subreddit, and that any subreddit or post that is linked to in the description appears first.
                                    this.threadCollection.sort(function (a, b) {
                                        return b.score > a.score
                                    }.bind(this));

                                    for (let i = 0, len = this.threadCollection.length; i < len; i += 1) {
                                        if (this.threadCollection[i].subreddit === preferredSubreddit) {
                                            let threadDataForFirstTab = this.threadCollection[i];
                                            this.threadCollection.splice(i, 1);
                                            this.threadCollection.splice(0, 0, threadDataForFirstTab);
                                            break;
                                        }
                                    }

                                    // Generate tabs.
                                    let tabContainerTemplate = Application.getExtensionTemplateItem(this.template, "tabcontainer");
                                    let tabContainer = <HTMLDivElement> tabContainerTemplate.querySelector("#at_tabcontainer");
                                    this.insertTabsIntoDocument(tabContainer, 0);
                                    window.addEventListener("resize", this.updateTabsToFitToBoundingContainer.bind(this), false);

                                    let ApplicationContainer = this.set(tabContainer);
                                    ApplicationContainer.appendChild(tabContainerTemplate.querySelector("#at_comments"));

                                    // If the selected post is prioritised, marked it as such
                                    if (this.threadCollection[0].id === preferredPost || this.threadCollection[0].subreddit === preferredSubreddit) {
                                        this.threadCollection[0].official = true;
                                    }

                                    // Load the first tab.
                                    this.downloadThread(this.threadCollection[0]);
                                    return;
                                }
                            }
                            this.returnNoResults();
                        }
                    }.bind(this), null, loadingScreen, false);
                }.bind(this));
            }
        }

        /**
            * Display a tab in the comment section, if it is locally cached, use that, if not, download it.
            * @param threadData Data about the thread to download from a Reddit search page.
            * @private
        */
        private showTab(threadData: any) {
            let getTabById = this.storedTabCollection.filter(function(x) {
                return x[0].data.children[0].data.name === threadData.name;
            });
            if (getTabById.length > 0) {
                new CommentThread(getTabById[0], this)
            } else {
                this.downloadThread(threadData);
            }
        }

        /**
            * Download a thread from Reddit.
            * @param threadData Data about the thread to download from a Reddit search page.
        */
        public downloadThread(threadData: any) {
            let loadingScreen = new LoadingScreen(this, LoadingState.LOADING, Application.localisationManager.get("loading_post_message"));
            let alientubeCommentContainer = document.getElementById("at_comments");
            while (alientubeCommentContainer.firstChild) {
                alientubeCommentContainer.removeChild(alientubeCommentContainer.firstChild);
            }
            alientubeCommentContainer.appendChild(loadingScreen.HTMLElement);

            let requestUrl = `https://api.reddit.com/r/${threadData.subreddit}/comments/${threadData.id}.json?sort=${Preferences.getString("threadSortType")}`;
            new AlienTube.Reddit.Request(requestUrl, RequestType.GET, function (responseObject) {
                // Remove previous tab from memory if preference is unchecked; will require a download on tab switch.
                responseObject[0].data.children[0].data.official = threadData.official;

                new CommentThread(responseObject, this);
                this.storedTabCollection.push(responseObject);
            }.bind(this), null, loadingScreen, false);
        }

        /**
            * Sets the contents of the comment section.
            * @param contents HTML DOM node or element to use.
        */
        public set(contents: Node) {
            let redditContainer = document.createElement("section");
            redditContainer.id = "alientube";

            let commentsContainer;
            let serviceCommentsContainer;
            if (Application.currentMediaService() === Service.YouTube) {
                commentsContainer = document.querySelector("ytd-comments#comments");
                serviceCommentsContainer = document.querySelector("ytd-comments#comments > ytd-item-section-renderer");
            } else if (Application.currentMediaService() === Service.Vimeo) {
                commentsContainer = document.querySelector(".comments_container");
                serviceCommentsContainer = document.querySelector(".comments_hide");
            }

            let previousRedditInstance = document.getElementById("alientube");
            if (previousRedditInstance) {
                commentsContainer.removeChild(previousRedditInstance);
            }


            /* Check if Dark Mode is activated, and set AlienTube to dark mode */
            (<any>this).checkEnvironmentDarkModestatus(redditContainer);

            /* Since there is no implicit event for a css property has changed, I have set a small transition on the body background colour.
               this transition will trigger the transitionend event and we can use that to check if the background colour has changed, thereby activating dark mode. */
            document.body.addEventListener("transitionend", function (e : TransitionEvent) {
                if (e.propertyName === "background-color" && e.srcElement.tagName === "BODY") {
                    (<any>this).checkEnvironmentDarkModestatus(document.getElementById("alientube"));
                }
            }, false);

            if (serviceCommentsContainer) {
                /* Add the "switch to Reddit" button in the google+ comment section */
                let redditButton = <HTMLDivElement> document.getElementById("at_switchtoreddit");
                if (!redditButton) {
                    let redditButtonTemplate = Application.getExtensionTemplateItem(this.template, "switchtoreddit");
                    redditButton = <HTMLDivElement> redditButtonTemplate.querySelector("#at_switchtoreddit");
                    redditButton.addEventListener("click", this.onRedditClick, true);
                    serviceCommentsContainer.parentNode.insertBefore(redditButton, serviceCommentsContainer);
                }

                if (this.getDisplayActionForCurrentChannel() === "gplus") {
                    redditContainer.style.display = "none";
                    redditButton.style.display = "block";
                } else {
                    serviceCommentsContainer.style.visibility = "collapse";
                    serviceCommentsContainer.style.height = "0";
                    serviceCommentsContainer.style.overflow = "hidden";
                }
            }

            /* Set the setting for whether or not AlienTube should show itself on this YouTube channel */
            let allowOnChannelContainer = document.getElementById("allowOnChannelContainer");
            if (!allowOnChannelContainer) {
                let actionsContainer;
                if (Application.currentMediaService() === Service.YouTube) {
                    actionsContainer = document.querySelector("#upload-info");
                } else if (Application.currentMediaService() === Service.Vimeo) {
                    actionsContainer = document.querySelector(".video_meta .byline");
                }
                let allowOnChannel = Application.getExtensionTemplateItem(this.template, "allowonchannel");
                allowOnChannel.children[0].appendChild(document.createTextNode(Application.localisationManager.get("options_label_showReddit")));
                let allowOnChannelCheckbox = allowOnChannel.querySelector("#allowonchannel");
                allowOnChannelCheckbox.checked = (this.getDisplayActionForCurrentChannel() === "alientube");
                allowOnChannelCheckbox.addEventListener("change", this.allowOnChannelChange, false);
                actionsContainer.appendChild(allowOnChannel);
            }

            /* Add AlienTube contents */
            redditContainer.setAttribute("service", Service[Application.currentMediaService()]);
            redditContainer.appendChild(contents);
            commentsContainer.appendChild(redditContainer);
            return redditContainer;
        }

        /**
            * Validate a Reddit search result set and ensure the link urls go to the correct address.
            * This is done due to the Reddit search result being extremely unrealiable, and providing mismatches.

            * Additionally, remove ones that have passed the 6 month threshold for Reddit posts and are in preserved mode,
            * but does not have any comments.

            * @param itemFromResultSet An object from the reddit search result array.
            * @param currentVideoIdentifier A YouTube video identifier to compare to.
            * @returns A boolean indicating whether the item is actually for the current video.
            * @private
        */
        private static validateItemFromResultSet(itemFromResultSet: any, currentVideoIdentifier: string): Boolean {
            if (Utilities.isRedditPreservedPost(itemFromResultSet) && itemFromResultSet.num_comments < 1) {
                return false;
            }

            if (itemFromResultSet.domain === "youtube.com") {
                // For urls based on the full youtube.com domain, retrieve the value of the "v" query parameter and compare it.
                let urlSearch = itemFromResultSet.url.substring(itemFromResultSet.url.indexOf("?") + 1);
                let requestItems = urlSearch.split('&');
                for (let i = 0, len = requestItems.length; i < len; i += 1) {
                    let requestPair = requestItems[i].split("=");
                    if (requestPair[0] === "v" && requestPair[1] === currentVideoIdentifier) {
                        return true;
                    }
                    if (requestPair[0] === "amp;u") {
                        let component = decodeURIComponent(requestPair[1]);
                        component = component.replace("/watch?", "");
                        let shareRequestItems = component.split('&');
                        for (let j = 0, slen = shareRequestItems.length; j < slen; j += 1) {
                            let shareRequestPair = shareRequestItems[j].split("=");
                            if (shareRequestPair[0] === "v" && shareRequestPair[1] === currentVideoIdentifier) {
                                return true;
                            }
                        }
                    }
                }
            } else if (itemFromResultSet.domain === "youtu.be" || itemFromResultSet.domain === "vimeo.com") {
                // For urls based on the shortened youtu.be domain, retrieve everything the path after the domain and compare it.
                let urlSearch = itemFromResultSet.url.substring(itemFromResultSet.url.lastIndexOf("/") + 1);
                let obj = urlSearch.split('?');
                if (obj[0] === currentVideoIdentifier) {
                    return true;
                }
            }
            return false;
        }

        /**
            * Insert tabs to the document calculating the width of tabs and determine how many you can fit without breaking the
            * bounds of the comment section.

            * @param tabContainer The tab container to operate on.
            * @param [selectTabAtIndex] The tab to be in active / selected status.
        */
        public insertTabsIntoDocument(tabContainer: HTMLElement, selectTabAtIndex?: number) {
            let overflowContainer = <HTMLDivElement> tabContainer.querySelector("#at_overflow");
            let len = this.threadCollection.length;
            let maxWidth;
            if (Application.currentMediaService() === Service.YouTube) {
                maxWidth = document.getElementById("comments").offsetWidth - 80;
            } else if (Application.currentMediaService() === Service.Vimeo) {
                maxWidth = document.getElementById("comments").offsetWidth - 80;
            }
            
            let width = (21 + this.threadCollection[0].subreddit.length * 7);
            let i = 0;

            /* Calculate the width of tabs and determine how many you can fit without breaking the bounds of the comment section. */
            if (len > 0) {
                for (i = 0; i < len; i += 1) {
                    width = width + (21 + (this.threadCollection[i].subreddit.length * 7));
                    if (width >= maxWidth) {
                        break;
                    }
                    let tab = document.createElement("button");
                    tab.className = "at_tab";
                    tab.setAttribute("data-value", this.threadCollection[i].subreddit);
                    let tabLink = document.createElement("a");
                    tabLink.textContent = this.threadCollection[i].subreddit;
                    tabLink.setAttribute("href", "http://reddit.com/r/" + this.threadCollection[i].subreddit);
                    tabLink.setAttribute("target", "_blank");
                    tab.addEventListener("click", this.onSubredditTabClick.bind(this), false);
                    tab.appendChild(tabLink);
                    tabContainer.insertBefore(tab, overflowContainer);
                }

                // We can't fit any more tabs. We will now start populating the overflow menu.
                if (i < len) {
                    overflowContainer.style.display = "block";

                    /* Click handler for the overflow menu button, displays the overflow menu. */
                    overflowContainer.addEventListener("click", function () {
                        let overflowContainerMenu = <HTMLUListElement> overflowContainer.querySelector("ul");
                        overflowContainer.classList.add("show");
                    }, false);

                    /* Document body click handler that closes the overflow menu when the user clicks outside of it.
                    by defining event bubbling in the third argument we are preventing clicks on the menu from triggering this event */
                    document.body.addEventListener("click", function () {
                        let overflowContainerMenu = <HTMLUListElement> overflowContainer.querySelector("ul");
                        overflowContainer.classList.remove("show");
                    }, true);

                    /* Continue iterating through the items we couldn't fit into tabs and populate the overflow menu. */
                    for (i = i; i < len; i += 1) {
                        let menuItem = document.createElement("li");
                        menuItem.setAttribute("data-value", this.threadCollection[i].subreddit);
                        menuItem.addEventListener("click", this.onSubredditOverflowItemClick.bind(this), false);
                        let itemName = document.createTextNode(this.threadCollection[i].subreddit);
                        menuItem.appendChild(itemName);
                        overflowContainer.children[1].appendChild(menuItem);
                    }
                } else {
                    /* If we didn't need the overflow menu there is no reason to show it. */
                    overflowContainer.style.display = "none";
                }
            } else {
                overflowContainer.style.display = "none";
            }
            
            // If there is only one thread available the container should be displayed differently.
            if (this.threadCollection[0].subreddit.length === 1) {
                tabContainer.classList.add("single");
            } else {
                tabContainer.classList.remove("single");
            }

            // Set the active tab if provided
            if (selectTabAtIndex != null) {
                let selectedTab = <HTMLButtonElement>tabContainer.children[selectTabAtIndex];
                selectedTab.classList.add("active");
            }
        }

        /**
            * Set the comment section to the "No Results" page.
            * @private
        */
        private returnNoResults() {
            let template = Application.getExtensionTemplateItem(this.template, "noposts");
            let message = template.querySelector(".single_line");
            message.textContent = Application.localisationManager.get("post_label_noresults");

            /* Set the icon, text, and event listener for the button to switch to the Google+ comments. */
            let googlePlusButton = template.querySelector("#at_switchtogplus");
            googlePlusButton.addEventListener("click", this.onGooglePlusClick, false);

            let googlePlusContainer = <HTMLElement>document.querySelector("ytd-comments#comments > ytd-item-section-renderer");
            
            if (Preferences.getBoolean("showGooglePlusButton") === false || googlePlusContainer === null) {
                googlePlusButton.style.display = "none";
            }

            this.set(template);

            if (Preferences.getBoolean("showGooglePlusWhenNoPosts") && googlePlusContainer) {
                googlePlusContainer.style.visibility = "visible";
                googlePlusContainer.style.height = "auto";
                document.getElementById("alientube").style.display = "none";

                let redditButton = <HTMLDivElement> document.getElementById("at_switchtoreddit");
                if (redditButton) {
                    redditButton.classList.add("noresults");
                }
            }
        }
    	
        /**
         * Switch to the Reddit comment section
         * @param eventObject The event object of the click of the Reddit button.
         * @private
         */
        private onRedditClick(eventObject: Event) {
            let googlePlusContainer = <HTMLElement>document.querySelector("ytd-comments#comments > ytd-item-section-renderer");
            googlePlusContainer.style.visibility = "collapse";
            googlePlusContainer.style.height = "0";
            let alienTubeContainer = document.getElementById("alientube");
            alienTubeContainer.style.display = "block";
            let redditButton = <HTMLDivElement> document.getElementById("at_switchtoreddit");
            redditButton.style.display = "none";
        }
    	
        /**
            * Switch to the Google+ comment section.
            * @param eventObject The event object of the click of the Google+ button.
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
        }

        /**
            * Update the tabs to fit the new size of the document
            * @private
        */
        private updateTabsToFitToBoundingContainer() {
            /* Only perform the resize operation when we have a new frame to work on by the browser, any animation beyond this will not
            be rendered and is pointless. */
            window.requestAnimationFrame(function () {
                let tabContainer = document.getElementById("at_tabcontainer");

                if (!tabContainer) {
                    return;
                }
                let overflowContainer = <HTMLDivElement> tabContainer.querySelector("#at_overflow");

                /* Iterate over the tabs until we find the one that is currently selected, and store its value. */
                for (let i = 0, len = tabContainer.children.length; i < len; i += 1) {
                    let tabElement = <HTMLButtonElement> tabContainer.children[i];
                    if (tabElement.classList.contains("active")) {
                        let currentActiveTabIndex = i;

                        /* Remove all tabs and overflow ites, then render them over again using new size dimensions. */
                        this.clearTabsFromTabContainer();
                        this.insertTabsIntoDocument(tabContainer, currentActiveTabIndex);
                        break;
                    }
                }
            }.bind(this));
        }

        /** 
            * Remove all tabs and overflow items from the DOM.
         */
        public clearTabsFromTabContainer() {
            let tabContainer = document.getElementById("at_tabcontainer");
            let overflowContainer = <HTMLDivElement> tabContainer.querySelector("#at_overflow");

            /* Iterate over the tab elements and remove them all. Stopping short off the overflow button. */
            while (tabContainer.firstElementChild) {
                let childElement = <HTMLUnknownElement> tabContainer.firstElementChild;
                if (childElement.classList.contains("at_tab")) {
                    tabContainer.removeChild(tabContainer.firstElementChild);
                } else {
                    break;
                }
            }

            /* Iterate over the overflow items, removing them all. */
            let overflowListElement = <HTMLUListElement> overflowContainer.querySelector("ul");
            while (overflowListElement.firstElementChild) {
                overflowListElement.removeChild(overflowListElement.firstElementChild);
            }
        }

        /**
            * Select the new tab on click and load comment section.
            * @param eventObject the event object of the subreddit tab click.
            * @private
        */
        private onSubredditTabClick(eventObject: Event) {
            let tabElementClickedByUser = <HTMLButtonElement> eventObject.target;

            /* Only continue if the user did not click a tab that is already selected. */
            if (!tabElementClickedByUser.classList.contains("active") && tabElementClickedByUser.tagName === "BUTTON") {
                let tabContainer = document.getElementById("at_tabcontainer");
                let currentIndexOfNewTab = 0;

                /* Iterate over the tabs to find the currently selected one and remove its selected status */
                for (let i = 0, len = tabContainer.children.length; i < len; i += 1) {
                    let tabElement = <HTMLButtonElement> tabContainer.children[i];
                    if (tabElement === tabElementClickedByUser) currentIndexOfNewTab = i;
                    tabElement.classList.remove("active");
                }

                /* Mark the new tab as selected and start downloading it. */
                tabElementClickedByUser.classList.add("active");
                this.showTab(this.threadCollection[currentIndexOfNewTab]);
            }
        }

        /**
            * Create a new tab and select it when an overflow menu item is clicked, load the comment section for it as well.
            * @param eventObject the event object of the subreddit menu item click.
            * @private
        */
        private onSubredditOverflowItemClick(eventObject: Event) {
            let tabContainer = document.getElementById("at_tabcontainer");
            let overflowItemClickedByUser = <HTMLLIElement> eventObject.target;
            let currentIndexOfNewTab = 0;

            /* Iterate over the current overflow items to find the index of the one that was just clicked. */
            let listOfExistingOverflowItems = <HTMLUListElement> overflowItemClickedByUser.parentNode;
            for (let i = 0, len = listOfExistingOverflowItems.children.length; i < len; i += 1) {
                let overflowElement = <HTMLLIElement> listOfExistingOverflowItems.children[i];
                if (overflowElement === overflowItemClickedByUser) currentIndexOfNewTab = i;
            }

            /* Derive the total index of the item in the subreddit list from the number we just calculated added
             with the total length of the visible non overflow tabs */
            currentIndexOfNewTab = (tabContainer.children.length) + currentIndexOfNewTab - 1;
            let threadDataForNewTab = this.threadCollection[currentIndexOfNewTab];

            /* Move the new item frontmost in the array so it will be the first tab, and force a re-render of the tab control. */
            this.threadCollection.splice(currentIndexOfNewTab, 1);
            this.threadCollection.splice(0, 0, threadDataForNewTab);
            this.clearTabsFromTabContainer();
            this.insertTabsIntoDocument(tabContainer, 0);

            /* Start downloading the new tab. */
            this.showTab(this.threadCollection[0]);
            eventObject.stopPropagation();
        }
        
        /**
            * Triggered when the user has changed the value of the "Allow on this channel" checkbox.
            * @param eventObject the event object of the checkbox value change.
            * @private
         */
        private allowOnChannelChange(eventObject: Event) {
            let allowedOnChannel = (<HTMLInputElement>eventObject.target).checked;
            let channelId = document.querySelector(".ytd-video-owner-renderer > a").getAttribute("href").split("/").pop();
            let channelDisplayActions = Preferences.getObject("channelDisplayActions");
            channelDisplayActions[channelId] = allowedOnChannel ? "alientube" : "gplus";
            Preferences.set("channelDisplayActions", channelDisplayActions);
        }
        
        /**
         * Get the display action of the current channel.
         * @private
         */
        private getDisplayActionForCurrentChannel() {
            let channelId;
            if (Application.currentMediaService() === Service.YouTube) {
                channelId = document.querySelector(".ytd-video-owner-renderer > a").getAttribute("href").split("/").pop();
            } else if (Application.currentMediaService() === Service.Vimeo) {
                channelId = document.querySelector("a[rel='author']").getAttribute("href").substring(1);
            }
            let displayActionByUser = Preferences.getObject("channelDisplayActions")[channelId];
            if (displayActionByUser) {
                return displayActionByUser;
            }
            return Preferences.getString("defaultDisplayAction");
        }
        
        /**
         * Get the confidence vote of a thread using Reddit's 'hot' sorting algorithm.
         * @param thread An object from the Reddit API containing thread information.
         * @private
         */
        private getConfidenceForRedditThread(thread : any) : number {
            let order = Math.log(Math.max(Math.abs(thread.score), 1));
            
            let sign;
            if (thread.score > 0) {
                sign = 1;
            } else if (thread.score < 0) {
                sign = -1;
            } else {
                sign = 0;
            }
            
            let seconds = <number> Math.floor(((new Date()).getTime() / 1000) - thread.created_utc) - 1134028003;
            return Math.round((order + sign*seconds / 4500) * 10000000) / 10000000;
        }
        
        /**
         * Check whether the website is currently using a "dark mode" plugin, and change AlienTube's style to comply.
         * @param alienTubeContainer DOM node of an AlienTube section element to apply the style to.
         * @private
         */
        private checkEnvironmentDarkModestatus(alientubeContainer : any) {
            let bodyBackgroundColour = window.getComputedStyle(document.body, null).getPropertyValue('background-color');
            let bodyBackgroundColourArray = bodyBackgroundColour.substring(4, bodyBackgroundColour.length - 1).replace(/ /g, '').split(',');
            let bodyBackgroundColourAverage = 0;
            for (let i = 0; i < 3; i += 1) {
                bodyBackgroundColourAverage = bodyBackgroundColourAverage + parseInt(bodyBackgroundColourArray[i], 10);
            }
            bodyBackgroundColourAverage = bodyBackgroundColourAverage / 3;
            if (bodyBackgroundColourAverage < 100 || document.documentElement.getAttribute("dark")) {
                alientubeContainer.classList.add("darkmode");
            } else {
                alientubeContainer.classList.remove("darkmode");
            }
        }
        
        /**
         * Get the Reddit search string to perform.
         * @param videoID The YouTube or Vimeo video id to make a search for.
         * @returns A search string to send to the Reddit search API.
         * @private
         */
        private getVideoSearchString(videoID : string) {
            if (Application.currentMediaService() === Service.YouTube) {
                return encodeURI(`(url:3D${videoID} OR url:${videoID}) (site:youtube.com OR site:youtu.be)`);
            } else if (Application.currentMediaService() === Service.Vimeo) {
                return encodeURI(`url:https://vimeo.com/${videoID} OR url:http://vimeo.com/${videoID}`);
            }
        }
    }
}
