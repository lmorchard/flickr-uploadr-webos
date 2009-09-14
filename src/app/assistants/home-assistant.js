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

            this.model = { foo: [ ] };

            this.controller.setupWidget(
                'foolist',
                {
                    reorderable:   false,
                    swipeToDelete: true,
                    itemTemplate:  'home/list-item',
                    listTemplate:  'home/list-container',
                    emptyTemplate: 'home/list-empty',
                    itemsProperty: 'foo'
                },
                this.model
            );

            try {
                this.img_service = new MediaDBImageService();

                var chain = new Decafbad.Chain([
                    
                    function (chain) {
                        this.model.foo = [];
                        this.img_service.listImages(
                            null, null, null, null, false,
                            chain.nextCallback(),
                            this.controller
                        );
                    },

                    function (chain, service_rv) {
                        var sub_chain = new Decafbad.Chain([], this);

                        service_rv.images.each(function (image) {
                            sub_chain.push(function (chain) {

                                Mojo.log('FOO %j', image);
                            
                                var req = new Ajax.Request('file:' + image.imagePath, {
                                    method: 'get',
                                    onSuccess: function (resp) {
                                        image.size = resp.responseText.length;
                                        Mojo.log('BAR1 %j', $H(resp).keys());
                                        Mojo.log('BAR2 %j', resp.getAllHeaders());
                                        this.model.foo.push(image);
                                        sub_chain.next();
                                    }.bind(this),
                                    onFailure: function () {
                                        Mojo.log("XHR ERROR %j", $A(arguments));
                                    }
                                });

                            });
                        }, this);

                        sub_chain.push(chain.nextCallback());
                        sub_chain.next();
                    },

                    function (chain) {

                        var list = this.controller.get('foolist');
                        list.mojo.noticeUpdatedItems(0, this.model.foo);
                        list.mojo.setLength(this.model.foo.length);
                                
                    }

                ], this, function () { Mojo.Log.error('IMG LIST FAILED'); });

                chain.next();

            } catch (e) {
                Mojo.Log.logException(e);
            }
           
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

        /**
         * Menu command dispatcher.
         */
        handleCommand: function (event) {
            if (event.type === Mojo.Event.command) {
                if ('MenuAbout' === event.command) {
                    this.showAbout();
                }
            }
        },

        /**
         * Show the about dialog.
         */
        showAbout: function () {
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
