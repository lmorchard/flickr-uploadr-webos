
var MediaDBImageService = Class.create(
{
	_commonParams : function(offset, limit, filter)
	{
		var parameters = {};

		if (limit >= 0)
			parameters['limit'] = limit;
		if (offset >= 0)
			parameters['offset'] = offset;
		if (filter)
			parameters['filter'] =
				'%' + filter.replace("\\", "\\\\")
						.replace("_", "\\_")
						.replace("%", "\\%") + '%';

		return parameters;
	},

	getState : function(callback, sceneController)
	{
		return sceneController.serviceRequest(
			'palm://com.palm.mediadb/',
			{
				method : 'getstate',
				onSuccess : callback,
				onFailure : callback,
				resubscribe: true,
				parameters : {subscribe : true}
			},{resubscribe: true});
	},

	deleteFile : function(path, callback, sceneController)
	{
		return sceneController.serviceRequest(
				'palm://com.palm.mediadb/', {
					method: 'deletefile',
					onSuccess: callback,
					onFailure: callback,
					parameters: { path : path }
				});
	},

	listAlbums : function(offset, limit, filter, callback, sceneController)
	{
		var parameters = this._commonParams(offset, limit, filter);

		Mojo.Log.info("Making get albums service request");
		parameters['subscribe'] = true;
		parameters['albumNameAllImages'] = $L('All images');
		parameters['albumNamePhotoRoll'] = $L('Photo roll');
		parameters['albumNameMiscImages'] = $L('Miscellaneous');
		parameters['albumNameSyncImages'] = $L('Media sync');

		return sceneController.serviceRequest(
				'palm://com.palm.mediadb/image', {
					method: 'listalbums',
					onSuccess: callback,
					parameters: parameters
				});
	},

	listImages : function(	offset, limit, filter, albumID, subscribe,
				callback, sceneController)
	{
		var parameters = this._commonParams(offset, limit, filter);

		if (subscribe)
			parameters['subscribe'] = true;
		if (albumID > 0)
			parameters['albumID'] = albumID;

		return sceneController.serviceRequest(
				'palm://com.palm.mediadb/image', {
					method: 'listimages',
					onSuccess: callback,
					parameters: parameters
				});
	}
});

