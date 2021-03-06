/*global jQuery, MM, _ */
MM.LayoutExportController = function (mapModel, fileSystem, poller, activityLog) {
	'use strict';
	var category = 'Map',
		eventType = 'PDF Export';
	this.startExport = function (exportProperties) {
		var deferred = jQuery.Deferred(),
			isStopped = function () {
				return deferred.state() !== 'pending';
			},
			reject = function (reason, fileId) {
				activityLog.log(category, eventType + ' failed', reason);
				deferred.reject(reason, fileId);
			},
			layout = _.extend({}, mapModel.getCurrentLayout(), exportProperties);
		activityLog.log(category, eventType + ' started');
		fileSystem.saveMap(JSON.stringify(layout)).then(function (fileId, config) {
			var resolve = function () {
				activityLog.log(category, eventType + ' completed');
				deferred.resolve(config.signedOutputUrl);
			};

			poller.poll(config.signedErrorListUrl, isStopped).then(function () { reject('generation-error', fileId); });
			poller.poll(config.signedOutputListUrl, isStopped).then(resolve, function (reason) { reject(reason, fileId); });
		}, reject);
		return deferred.promise();
	};
};

jQuery.fn.layoutExportWidget = function (layoutExportController) {
	'use strict';
	var self = this,
		confirmElement = self.find('[data-mm-role=export]'),
		setState = function (state) {
			self.find('.visible').hide();
			self.find('.visible' + '.' + state).show();
		},
		exportComplete = function (url) {
			self.find('[data-mm-role=output-url]').attr('href', url);
			setState('done');
		},
		getExportMetadata = function () {
			var form = self.find('form'),
				exportType = {};
			form.find('button.active').add(form.find('select')).each(function () {
				exportType[jQuery(this).attr('name')] = jQuery(this).val();
			});
			return exportType;
		},
		exportFailed = function (reason, fileId) {
			self.find('[data-mm-role=contact-email]').attr('href', function () { return 'mailto:' + jQuery(this).text() + '?subject=MindMup%20PDF%20Export%20Error%20' + fileId; });
			self.find('[data-mm-role=file-id]').html(fileId);
			self.find('.error span').hide();
			setState('error');

			var predefinedMsg = self.find('[data-mm-role=' + reason + ']');
			if (predefinedMsg.length > 0) {
				predefinedMsg.show();
			} else {
				self.find('[data-mm-role=error-message]').html(reason).show();
			}
		},
		doExport = function () {
			setState('inprogress');
			layoutExportController.startExport({'export': getExportMetadata()}).then(exportComplete, exportFailed);
		};
	self.find('form').submit(function () {return false; });
	confirmElement.click(doExport).keydown('space', doExport);
	self.modal({keyboard: true, show: false});
	this.on('show', function () {
		setState('initial');
	}).on('shown', function () {

		confirmElement.focus();
	});

};
