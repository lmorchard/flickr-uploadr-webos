/**
 * @fileOverview Wrapper for Flickr API
 * @author <a href="http://decafbad.com">l.m.orchard@pobox.com</a>
 * @version 0.1
 */
/*jslint laxbreak: true */
/*global Mojo, FlickrUploadr, Chain, Class, Ajax */
FlickrUploadr.API = function() {
    this.initialize.apply(this, $A(arguments));
};

FlickrUploadr.API.prototype = /** @lends FlickrUploadr.API */ {

    /**
     * Wrapper for Flickr API
     * @constructs
     * @author l.m.orchard@pobox.com
     *
     * @param {string} Flickr API base URL
     */
    initialize: function(options) {
        this.options = Object.extend({
            
            "api_url":    "http://api.flickr.com/services/rest/",
            "upload_url": "http://dev.memento.decafbad.com:8882/~lorchard/echolog.php",
            //"upload_url": "http://dev.memento.decafbad.com/~lorchard/echolog.php",
            //"upload_url": "http://api.flickr.com/services/upload/",
            "key":        "6242a9901ab1632a207b308531bee3c3",
            "secret":     "11c59547e2ed3886",
            "token":  null

        }, options || {});
    },

    /**
     * flickr.auth.getFrob method
     *
     * @param {object}   params     Parameters, should be empty
     * @param {function} on_success Success callback, passed frob & login URL
     * @param {function} on_failure Failure callback
     */
    auth_getFrob: function (params, on_success, on_failure) {
        this.apiRequest(
            'flickr.auth.getFrob',
            { parameters: params },
            function (data, resp) {
                var frob = data.frob._content;
                var login_url = 'http://flickr.com/services/auth/?' + 
                    $H(this.escape_and_sign({
                        api_key: this.options.key,
                        perms:   "delete",
                        frob:    frob
                    })).toQueryString();
                on_success(frob, login_url, data, resp);
            }.bind(this),
            on_failure
        );
    },

    /**
     * flickr.auth.getToken method
     *
     * @param {object}   params
     * @param {object}   params.frob Auth frob resulting from auth.getFrob
     * @param {function} on_success  Success callback, passed token, user, perms
     * @param {function} on_failure  Failure callback
     */
    auth_getToken: function (params, on_success, on_failure) {
        this.apiRequest(
            'flickr.auth.getToken', 
            { parameters: params },
            function (data, resp) {
                this.options.token = data.auth.token._content;
                on_success(
                    data.auth.token._content, 
                    data.auth.user, 
                    data.auth.perms, 
                    data, resp
                );
            }.bind(this),
            on_failure
        );
    },

    /**
     * flickr.auth.checkToken method
     *
     * @param {object}   params     Parameters, should be empty
     * @param {function} on_success
     * @param {function} on_failure
     */
    auth_checkToken: function (params, on_success, on_failure) {
        this.apiRequest(
            'flickr.auth.checkToken', 
            { parameters: params },
            function (data, resp) {
                on_success(
                    data.auth.token._content, 
                    data.auth.user, 
                    data.auth.perms, 
                    data, resp
                );
            }.bind(this),
            on_failure
        );
    },

    /**
     * Photo upload method.
     *
     * @param {object}   params         API params
     * @param {object}   photo          Photo for upload
     * @param {object}   photo.filename Photo filename
     * @param {object}   photo.data     Photo image data
     * @param {object}   photo.type     Photo MIME-Type
     * @param {function} on_success     success callback, passed user id
     * @param {function} on_failure     failure callback
     */
    uploadPhoto: function(params, photo, on_success, on_failure) {
        
        var req = new XMLHttpRequest(),
            s_params = this.escape_and_sign(Object.extend({
                "format": "json",
                "nojsoncallback": "1",
                "api_key": this.options.key,
                "auth_token": this.options.token
            }, params || {})),
            boundary = 't' + ((new Date()).getTime()) + '-' + Math.random(),
            lines = [];

        $H(s_params).each(function (pair) {
            lines.push(
                '--' + boundary,
                'Content-Disposition: form-data; name="' + pair.key + '"',
                '',
                pair.value
            );
        });
        
        lines.push(
            '--' + boundary,
            'Content-Disposition: form-data; name="photo"; ' + 
                'filename="' + photo.filename + '"',
            'Content-Transfer-Encoding: base64',
            'Content-Type: ' + photo.type,
            'Content-MD5: ' + dojox.encoding.digests.MD5(
                photo.data, dojox.encoding.digests.outputTypes.Hex
            ),
            '',
            photo.data,
            '--' + boundary + '--',
            ''
        );

        req.open('POST', this.options.upload_url);

        req.setRequestHeader("Content-Type", 
            "multipart/form-data; boundary=" + boundary);

        req.onreadystatechange = function (req) {
            if (this.readyState == 4) {
                if (this.status == 200) {
                    Mojo.log('XHR SUCCESS');
                    on_success(this);
                } else {
                    Mojo.log('XHR FAIL');
                    on_failure(this);
                }
            }
        };

        var post_body = lines.join("\r\n");
        req.send(post_body);

    },

    /**
     * Common API request call utility.
     *
     * @param {string}   api_method  Flickr API method
     * @param {object}   options     Ajax.Request options
     * @param {function} on_success  success callback, passed user id
     * @param {function} on_failure  failure callback
     */
    apiRequest: function (api_method, options, on_success, on_failure) {
        options = Object.extend({
            "method": "get",
            "evalJSON": "force",
            "onSuccess": function (resp) {
                var data = resp.responseJSON;
                if ('ok' === data.stat) {
                    on_success(data, $A(arguments));
                } else {
                    on_failure($A(arguments));
                }
            },
            "onFailure": on_failure
        }, options || {});

        options.parameters = Object.extend({
            "format": "json",
            "nojsoncallback": "1",
            "method": api_method,
            "api_key": this.options.key
        }, options.parameters || {});

        if (this.options.token) {
            options.parameters.auth_token = this.options.token;
        }

        options.parameters = this.escape_and_sign(options.parameters);

        return new Ajax.Request(this.options.api_url, options);
    },

    /**
     * Convert a string to byte[]
     */
    s2b: function (s) {
        var b = [];
        for (var i = 0; i < s.length; ++i) {
            b.push(s.charCodeAt(i));
        }
        return b;
    },

    /**
	 * Escape and sign a set of parameters, returning the new version
     *
     * Adapted from http://www.flickr.com/tools/uploadr/
     */
	escape_and_sign: function(params, post) {
		params.api_key = this.options.key;
		var sig = [];
		var esc_params = {api_key: '', api_sig: ''};
		for (var p in params) {
			if ('object' === typeof params[p]) {
				esc_params[p] = params[p];
			} else {
				sig.push(p);
				esc_params[p] = this.escape_utf8('' + params[p], !post)
					.replace(/(^\s+|\s+$)/g, '');
			}
		}
		sig.sort();
		var calc = [];
		var ii = sig.length;
		for (var i = 0; i < ii; ++i) {
			calc.push(sig[i] + (post ? esc_params[sig[i]] : this.escape_utf8('' +
				params[sig[i]], false)));
        }

        var clear = this.options.secret + calc.join('');
        esc_params.api_sig = dojox.encoding.digests.MD5(
            clear, dojox.encoding.digests.outputTypes.Hex
        );
		return esc_params;
	},

    /**
     * Used when preparing the params and the signature
     * The URL parameter controls whether data is escaped for inclusion
     * in a URL or not
     *
     * Adapted from http://www.flickr.com/tools/uploadr/
     */
    escape_utf8: function(data, url) {
        if (null === url) {
            url = false;
        }
        if ('' === data || null === data || undefined === data) {
            return '';
        }
            
        var chars = '0123456789abcdef';
        data = data.toString();
        var buffer = [];
        var ii = data.length;
        for (var i = 0; i < ii; ++i) {
            var c = data.charCodeAt(i);
            var bs = [];
            if (c > 0x10000) {
                bs[0] = 0xf0 | ((c & 0x1c0000) >>> 18);
                bs[1] = 0x80 | ((c & 0x3f000) >>> 12);
                bs[2] = 0x80 | ((c & 0xfc0) >>> 6);
                bs[3] = 0x80 | (c & 0x3f);
            } else if (c > 0x800) {
                bs[0] = 0xe0 | ((c & 0xf000) >>> 12);
                bs[1] = 0x80 | ((c & 0xfc0) >>> 6);
                bs[2] = 0x80 | (c & 0x3f);
            } else if (c > 0x80) {
                bs[0] = 0xc0 | ((c & 0x7c0) >>> 6);
                bs[1] = 0x80 | (c & 0x3f);
            } else {
                bs[0] = c;
            }
            var j = 0, jj = bs.length;
            if (1 < jj) {
                if (url) {
                    for (j = 0; j < jj; ++j) {
                        var b = bs[j];
                        buffer.push('%' + chars.charAt((b & 0xf0) >>> 4) +
                            chars.charAt(b & 0x0f));
                    }
                } else {
                    for (j = 0; j < jj; ++j) {
                        buffer.push(String.fromCharCode(bs[j]));
                    }
                }
            } else {
                if (url) {
                    buffer.push(encodeURIComponent(String.fromCharCode(bs[0])));
                } else {
                    buffer.push(String.fromCharCode(bs[0]));
                }
            }
        }
        return buffer.join('');
    },

    EOF:null // I hate trailing comma errors
};
