/// <reference path="index.ts" />
/**
    * Namespace for All AlienTube operations.
    * @namespace AlienTube
*/
module AlienTube {
    /**
        * The representation and management of an AlienTube loading screen.
        * @class CommentField
        * @param commentSection The active CommentSection to retrieve data from.
        * @param insertionPoint The DOM element in which the loading screen should be appended to as a child.
        * @param [initialState] An optional initial state for the loading screen, the default is "Loading"
    */
    "use strict";
    export class CommentField {
        private representedHTMLElement: HTMLDivElement;
        private parentHTMLElement: HTMLDivElement;
        private commentThread: CommentThread;
        private parentClass: any;
        private previewElement: HTMLDivElement;
        private edit: boolean;

        constructor(parent: any, initialText?: string, edit?: boolean) {
            /* Check if the paramter is a Coment Thread and assign the correct parent HTML element .*/
            if (parent instanceof CommentThread) {
                this.parentClass = <CommentThread> parent;
                this.commentThread = this.parentClass;
                this.parentHTMLElement = this.parentClass.threadContainer.querySelector(".options");

                /* Check if the parameter is a Comment and assign the correct parent HTML element.*/
            } else if (parent instanceof Comment) {
                this.parentClass = <Comment> parent;
                this.commentThread = this.parentClass.commentThread;
                this.parentHTMLElement = this.parentClass.representedHTMLElement.querySelector(".options");

            } else {
                new TypeError("parent needs to be type CommentThread or Type Comment");
            }
            this.edit = edit;

            let template = Application.getExtensionTemplateItem(this.commentThread.commentSection.template, "commentfield");
            this.representedHTMLElement = <HTMLDivElement> template.querySelector(".at_commentfield");

            /* Set the "You are now commenting as" text under the comment field. */
            let authorName = <HTMLSpanElement> this.representedHTMLElement.querySelector(".at_writingauthor");
            authorName.textContent = Application.localisationManager.get("commentfield_label_author", [Preferences.getString("username")]);

            /* Set the button text and event listener for the submit button */
            let submitButton = <HTMLButtonElement> this.representedHTMLElement.querySelector(".at_submit");
            submitButton.textContent = Application.localisationManager.get("commentfield_button_submit");
            submitButton.addEventListener("click", this.onSubmitButtonClick.bind(this), false);

            /* Set the button text and event listener for the cancel button */
            let cancelButton = <HTMLButtonElement> this.representedHTMLElement.querySelector(".at_cancel");
            cancelButton.textContent = Application.localisationManager.get("commentfield_button_cancel")
            cancelButton.addEventListener("click", this.onCancelButtonClick.bind(this), false);

            /* Set the text for the markdown preview header */
            let previewHeader = <HTMLSpanElement> this.representedHTMLElement.querySelector(".at_preview_header");
            previewHeader.textContent = Application.localisationManager.get("commentfield_label_preview");

            /* Check if we were initialised with some text (most likely from the show source button) and add event listener for input
            change */
            let inputField = <HTMLInputElement> this.representedHTMLElement.querySelector(".at_textarea");
            if (initialText) {
                inputField.value = initialText;
            }
            inputField.addEventListener("input", this.onInputFieldChange.bind(this), false);

            this.previewElement = <HTMLDivElement> this.representedHTMLElement.querySelector(".at_comment_preview");

            this.parentHTMLElement.appendChild(this.representedHTMLElement);
        }

        /**
         * Get the HTML element of the comment field.
         */
        get HTMLElement() {
            return this.representedHTMLElement;
        }

        /**
         * Handle the click of the submit button of the comment field.
         * @param eventObject The event object of the click of the submit button.
         * @private
         */
        private onSubmitButtonClick(eventObject: Event) {
            /* Disable the button on click so the user does not accidentally press it multiple times */
            let submitButton = <HTMLButtonElement> eventObject.target;
            submitButton.disabled = true;

            let inputField = <HTMLInputElement> this.representedHTMLElement.querySelector(".at_textarea");
            let thing_id = (this.parentClass instanceof CommentThread)
                ? this.parentClass.threadInformation.name : this.parentClass.commentObject.name;

            if (this.edit) {
                /* Send the edit comment request to reddit */
                new AlienTube.Reddit.EditCommentRequest(thing_id, inputField.value, (responseText) => {
                    this.parentClass.commentObject.body = inputField.value;
                    let editedCommentBody = this.parentClass.representedHTMLElement.querySelector(".at_commentcontent");
                    editedCommentBody.innerHTML = SnuOwnd.getParser().render(inputField.value);
                    this.parentClass.representedHTMLElement.classList.add("edited");


                    /* The comment box is no longer needed, remove it and clear outselves out of memory */
                    this.representedHTMLElement.parentNode.removeChild(this.representedHTMLElement);
                });
            } else {
                /* Send the comment to Reddit */
                new AlienTube.Reddit.CommentRequest(thing_id, inputField.value, (responseText) => {
                    let responseObject = JSON.parse(responseText);
                    let comment = new Comment(responseObject.json.data.things[0].data, this.commentThread);
                    this.parentClass.children.push(comment);

                    /* Find the correct insert location and append the new comment to DOM */
                    if (this.parentClass instanceof CommentThread) {
                        this.parentClass.threadContainer.appendChild(comment.representedHTMLElement);
                        new CommentField(this.parentClass);
                    } else {
                        this.parentClass.representedHTMLElement.querySelector(".at_replies").appendChild(comment.representedHTMLElement);
                    }
                    this.parentClass.children.push(comment);

                    /* Scroll the new comment in to view */
                    comment.representedHTMLElement.scrollIntoView(false);

                    /* The comment box is no longer needed, remove it and clear outselves out of memory */
                    this.representedHTMLElement.parentNode.removeChild(this.representedHTMLElement);
                });
            }
        }

        /**
         * Cancel / Remove the comment field.
         * @private
         */
        private onCancelButtonClick() {
            this.representedHTMLElement.parentNode.removeChild(this.representedHTMLElement);
        }

        /**
         * Handle the contents of the comment field changing.
         * @param eventObject The event object of the input field change.
         * @private
         */
        private onInputFieldChange(eventObject: Event) {
            let inputField = <HTMLInputElement> eventObject.target;

            /* If there is any contents of the input box, display the markdown preview and populate it. */
            if (inputField.value.length > 0) {
                this.previewElement.style.display = "block";
                let previewContents = <HTMLDivElement> this.previewElement.querySelector(".at_preview_contents");
                previewContents.innerHTML = SnuOwnd.getParser().render(inputField.value);
            } else {
                this.previewElement.style.display = "none";
            }
        }
    }
}
