/**
 * @fileOverview Tests for FlickrUploadr.API
 * @author <a href="http://decafbad.com">l.m.orchard@pobox.com</a>
 * @version 0.1
 */
/*jslint laxbreak: true */
/*global Mojo, FlickrUploadr, Chain, Class, Ajax */
function FlickrUploadr_API_Tests(tickleFunction) {
    this.initialize(tickleFunction);
}

// Extra long timeout to account for slow network.
FlickrUploadr_API_Tests.timeoutInterval = 60000;

FlickrUploadr_API_Tests.prototype = (function () {

    return /** @lends FlickrUploadr_API_Tests */ {

        /**
         * Test setup, run before execution of each test.
         *
         * @constructs
         * @author l.m.orchard@pobox.com
         *
         * @param {function} Test tickle function
         */
        initialize: function (tickleFunction) {
            this.tickleFunction = tickleFunction;
            this.api = new FlickrUploadr.API(); 
            this.img_service = new MediaDBImageService();
        },

        /**
         *
         */
        testAuth: function (recordResults) {
            var chain = new Decafbad.Chain([], this);

            if (FlickrUploadr.TestData.use_test_login) {
                
                // Use the cached auth details from test data.
                chain.push(function (chain) {
                    chain.next(
                        FlickrUploadr.TestData.test_token,
                        FlickrUploadr.TestData.test_user
                    );
                });

            } else {

                // Request a new frob and hope the user visits the login URL.
                chain.push(function (chain) {
                    this.api.auth_getFrob(
                        {}, 
                        function (frob, login_url) {
                            Mojo.log('getFrob: %j', frob);
                            Mojo.log('VISIT LOGIN URL NOW! (15 sec): %s', login_url);
                            this.tickleFunction();
                            window.setTimeout(chain.nextCallback(frob), 15000);
                        }.bind(this),
                        chain.errorCallback('testAuth, getFrob')
                    );
                });

                // After the timeout, try getting the token.
                chain.push(function (chain, frob) {
                    this.api.auth_getToken(
                        { frob: frob },
                        function (token, user) {
                            Mojo.log('getToken: %s', token);
                            Mojo.log('auth user: %j', user);
                            chain.next(token);
                        }.bind(this),
                        chain.errorCallback('testAuth, getToken')
                    );
                });

            }

            // Check the token, whether from test data or fresh auth sequence
            chain.push(function (chain, token) {
                this.api.options.token = token;
                this.api.auth_checkToken(
                    {},
                    function (token, user, perms) {
                        Mojo.log('checkToken: %s', token);
                        Mojo.log('auth user: %j', user);
                        Mojo.log('perms: %j', perms);
                        chain.next(token);
                    }.bind(this),
                    chain.errorCallback('testAuth, checkToken')
                );
            });

            chain.push(function (chain, token) {
                this.images = [];
                this.img_service.listImages(
                    null, null, null, null, false,
                    chain.nextCallback(token),
                    Mojo.Controller.stageController.topScene()
                );
            });

            chain.push(function (chain, token, service_rv) {
                var sub_chain = new Decafbad.Chain([], this);

                service_rv.images.each(function (image) {
                    sub_chain.push(function (chain) {
                        var req = new Ajax.Request('file:' + image.imagePath, {
                            method: 'get',
                            onSuccess: function (resp) {
                                image.size = resp.responseText.length;
                                image.data = resp.responseText;
                                this.images.push(image);
                                sub_chain.next();
                            }.bind(this),
                            onFailure: function () {
                                Mojo.log("XHR ERROR %j", $A(arguments));
                            }
                        });
                    });
                }, this);
                sub_chain.push(chain.nextCallback(token));
                sub_chain.next();
            });

            // Try uploading a photo
            chain.push(function (chain, token) {
                
                this.api.uploadPhoto(
                    { },
                    this.images[0].imagePath,
                    function (resp) {
                        Mojo.log("UPLOAD YAY %j", resp);
                        if (resp.completed && '200' == resp.httpCode) {
                            chain.next();
                        }
                    },
                    chain.errorCallback('testAuth, photoUpload')
                );
            });

            // Test passes, if we get here without error.
            chain.push(function (chain) {
                recordResults(Mojo.Test.passed);
            });

            // Fire it all up.
            chain.next();
        },

        EOF:null // I hate trailing comma errors
    };
}());
