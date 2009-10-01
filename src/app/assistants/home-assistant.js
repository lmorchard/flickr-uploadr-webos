/**
 * @fileOverview Home scene assistant
 * @author <a href="http://decafbad.com">l.m.orchard@pobox.com</a>
 * @version 0.1
 */
/*jslint laxbreak: true */
/*global Decafbad, FlickrUploadr, Mojo, $, $L, $A, $H, SimpleDateFormat */
function HomeAssistant() {
}

HomeAssistant.prototype = (function () { /** @lends HomeAssistant# */

    return {

        /**
         * Setup the application.
         */
        setup: function () {

            this.upload_in_progress = false;

            this.controller.setupWidget('upload-queue', 
                {
                    reorderable:   true,
                    swipeToDelete: true,
                    itemTemplate:  'home/list-item',
                    listTemplate:  'home/list-container',
                    emptyTemplate: 'home/list-empty',
                    addItemLabel:  $L('Queue a photo for upload'),
                    formatters: {
                        fullPath: this.fullPathFormatter.bind(this)
                    }
                }, 
                this.uploads_model = {
                    items: [ ]
                }
            );

            this.controller.setupWidget('upload-button', 
                { type: Mojo.Widget.activityButton }, 
                this.upload_button_model = {
                    disabled: true,
                    label: $L('Start Uploading...')
                }
            );

            this.controller.setupWidget(
                Mojo.Menu.appMenu, 
                { omitDefaultItems: true }, 
                {
                    visible: true,
                    items: [
                        //Mojo.Menu.editItem,
                        { label: "About", command: 'MenuAbout' }
                    ]
                }
            );

            var command_menu_model = {items: [
                //{ command:'addPhotoToQueue', label: $L('+ New ...'), 
                //    icon: 'new', shortcut: 'A' }
            ]};
            this.controller.setupWidget(
                Mojo.Menu.commandMenu, {}, command_menu_model
            );

        },

        /**
         * Format the path to an image using the undocumented extractfs image
         * scaler utility
         */
        fullPathFormatter: function(image, model) {
            var formatted = image;
            if (formatted) {
                formatted = "/var/luna/data/extractfs" +
                    encodeURIComponent(formatted) +
                    ":0:0:50:50:2";
            }
            return formatted;
        },

        /**
         * React to card activation.
         */
        activate: function (ev) {

            Decafbad.Utils.setupListeners([
                ['upload-queue',  Mojo.Event.listAdd,     this.handleQueueAdd],
                // ['upload-queue',  Mojo.Event.listTap,     this.handleQueueTap],
                ['upload-queue',  Mojo.Event.listDelete,  this.handleQueueDelete],
                ['upload-queue',  Mojo.Event.listReorder, this.handleQueueReorder],
                ['upload-button', Mojo.Event.tap,         this.handleUploadTap]
            ], this);

            // Try getting auth info...
            var token_cookie = new Mojo.Model.Cookie('flickr_token'),
                token = token_cookie.get(),
                user_cookie = new Mojo.Model.Cookie('flickr_user'),
                user = user_cookie.get();

            if (!token) {
                // If no token found, push the auth scene
                Mojo.log('No auth cookie, pushing auth scene');
                return this.controller.stageController.pushScene('auth');
            } else {
                // Token found, so go ahead and use it.
                Mojo.log('Auth: %j %j', token, user);
                AppGlobals.api.options.token = token;
                AppGlobals.api.options.user = user;
            }

            this.refreshUploadsQueue();

        },

        /**
         * Refresh the UI with current state of uploads queue.
         */
        refreshUploadsQueue: function () {

            // Update the queue display
            var upload_queue = this.controller.get('upload-queue');
            upload_queue.mojo.noticeUpdatedItems(0, this.uploads_model.items);
            upload_queue.mojo.setLength(this.uploads_model.items.length);

            // Twiddle the button enabled state based on queued of uploads
            this.upload_button_model.disabled = !(this.uploads_model.items.length > 0);
            this.controller.modelChanged(this.upload_button_model);

        },

        /**
         * React for card deactivation.
         */
        deactivate: function (ev) {
            Decafbad.Utils.clearListeners(this);
        },

        /**
         * Handle ultimate card clean up.
         */
        cleanup: function (ev) {
        },

        /**
         * Handle a request to queue an upload.
         */
        handleQueueAdd: function (event) {
            Mojo.FilePicker.pickFile({
                kinds: ['image'],
                actionType: 'attach',
                actionName: 'Queue For Upload',
                onSelect: function (choice) {
                    choice.name = choice.fullPath.split('/').pop();
                    choice.upload_status = 'queued';
                    choice.metadata = {};
                    this.uploads_model.items.push(choice);
                }.bind(this)
            }, this.controller.stageController);
        },

        /**
         * Handle a tap on a queued item for editing.
         */
        handleQueueTap: function (event) {
            return this.controller.stageController.pushScene(
                'photo', event.item
            );
        },

        /**
         * Handle item deletion in queue
         */
        handleQueueDelete: function (event) {
            // Remove the item from the queue model.
            this.uploads_model.items.splice(event.index, 1);

            // Twiddle the button enabled state based on queued of uploads
            this.upload_button_model.disabled = 
                !(this.uploads_model.items.length > 0);
            this.controller.modelChanged(this.upload_button_model);
        },

        /**
         * Handle queue reordering
         */
        handleQueueReorder: function (event) {
            // Move the item in the queue model
            this.uploads_model.items.splice(event.fromIndex, 1);
            this.uploads_model.items.splice(event.toIndex-1, 0, event.item);
        },

        /**
         * Handle a tap on the upload button.
         */
        handleUploadTap: function (event) {

            // Ignore taps during in-progress upload.
            if (this.upload_in_progress) { return; }
            this.upload_in_progress = true;
            
            // Remove the add item to prevent queuing during upload.
            this.controller.get('upload-queue').mojo.showAddItem(false);

            // Start a spinner
            this.upload_button_model.disabled = true;
            this.upload_button_model.label = 'Uploading...';
            this.controller.modelChanged(this.upload_button_model);

            // Mark all queued items as pending and queue the uploads.
            this.uploads_model.items.each(function (item, idx) {
                this.uploads_model.items[idx].upload_status = 'pending';
                AppGlobals.api.uploadPhoto(
                    item.choice,
                    item.fullPath, 
                    this.handleUploadSuccess.bind(this, item, idx),
                    this.handleUploadFailure.bind(this, item, idx)
                );
            }, this);

        },

        /**
         * Update UI in response to upload status success update.
         */
        handleUploadSuccess: function (item, idx, ev) {
            Mojo.log("UPLOAD PROGRESS: %j", $A([item, idx, $H(ev)]));

            if (!ev.completed) {
                // Note the ticket ID for the upload.
                this.uploads_model.items[idx].upload_ticket = ev.ticket;
            } else {
                if (200 === ev.httpCode) {
                    // This upload is finished.
                    // TODO: Do something with the photo ID from Flickr in XML
                    this.uploads_model.items[idx].upload_status = 'done';
                } else {
                    // This upload failed.
                    // TODO: Better error reporting
                    this.uploads_model.items[idx].upload_status = 'failed';
                }
            } 

            this.updateUploadFeedback();
        },

        /**
         * React to failures in the upload queue.
         */
        handleUploadFailure: function (item, idx, ev) {

            // This upload failed.
            // TODO: Better error reporting
            this.uploads_model.items[idx].upload_status = 'failed';
            Mojo.log("UPLOAD FAIL: %j", $A([item, idx, $H(ev)]));

            this.updateUploadFeedback();
        },

        /**
         * Update feedback on upload events.
         */
        updateUploadFeedback: function () {

            // Count the queued uploads still pending.
            var pending_count = this.uploads_model.items.filter(
                function (item) { 
                    return 'queued' !== item.upload_status && 
                        'pending' === item.upload_status;
                }
            ).length;

            this.refreshUploadsQueue();
            
            // Nothing left to do while uploads still pending.
            if (pending_count > 0) { return; }

            // No longer an upload in progress now.
            this.upload_in_progress = false;
            
            // Re-enable the add item button.
            this.controller.get('upload-queue').mojo.showAddItem(true);

            // Stop the spinner and restore the button.
            this.controller.get('upload-button').mojo.deactivate();
            this.upload_button_model.disabled = false;
            this.upload_button_model.label = $L('Start Uploading...');
            this.controller.modelChanged(this.upload_button_model);

            // Filter out the items that have been uploaded.
            this.uploads_model.items = this.uploads_model.items.filter(
                function (item) { return 'done' !== item.upload_status; }
            );
            this.refreshUploadsQueue();

            // Alert that the upload has been completed.
            this.controller.showAlertDialog({
                onChoose: function(value) {},
                title: $L("Upload Complete"),
                message: "Successful uploads have been removed from the queue." +
                    ((this.uploads_model.items.length > 0) ?
                        " Failed items are still in the queue." : ""),
                choices: [
                    {label:$L("OK"), value:""}
                ]
            });

        },

        /**
         * Menu command dispatcher.
         */
        handleCommand: function (event) {
            if(event.type !== Mojo.Event.command) { return; }
            var func = this['handleCommand'+event.command];
            if (typeof func !== 'undefined') {
                return func.apply(this, [event]);
            }
        },

        /**
         * Show the about dialog.
         */
        handleCommandMenuAbout: function () {
            this.controller.showAlertDialog({
                onChoose: function(value) {},
                title: $L("Flickr Uploadr"),
                message: [
                    "http://decafbad.com/"
                ].join('\n'),
                choices: [
                    {label:$L("OK"), value:""}
                ]
            });
        },

        EOF:null
    };
}());
