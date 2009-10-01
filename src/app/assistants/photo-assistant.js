/**
 * @fileOverview Photo scene assistant
 * @Photoor <a href="http://decafbad.com">l.m.orchard@pobox.com</a>
 * @version 0.1
 */
/*jslint laxbreak: true */
/*global Decafbad, AppGlobals, FlickrUploadr, Mojo, $, $L, $A, $H, SimpleDateFormat */
function PhotoAssistant(Photo_url) {
    this.Photo_url = Photo_url;
}

PhotoAssistant.prototype = (function () { /** @lends PhotoAssistant# */

    return {

        /**
         * Setup the application.
         */
        setup: function () {
        },

        /**
         * React to card activation.
         */
        activate: function (ev) {

            Decafbad.Utils.setupListeners([
            ], this);

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

        EOF:null
    };
}());
