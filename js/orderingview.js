/**
 * orderingview.js
 * 
 * @author Austin L <auslee986@gmail.com>
 * @version 1.0
 */


define(['ajax', 'plugin', 'notify', 'dropzone', 'datetimepicker', 'multiselect',
	'async!' + config.google.map_api_url
], function (ajax, plugin, notify, Dropzone) {

	Dropzone.autoDiscover = false;

	var fn = {

		red2_enable: 0,
		opts: null,
		is_init_done: false,
		last_select: null,
		non_decimal_currency: ['JPY', 'TWD', 'CLP'],

		ordering: {

			$active_store: null,
			$is_new_toggle: null,
			$is_new: null,

			$custom_nav: null,

			init: function () {

				fn.ordering.$active_store = $('#active_store', fn.opts.$wrap);
				fn.ordering.$custom_nav = $('#div_custom .content-sub-menu', fn.opts.$wrap);

				fn.ordering.$is_new = fn.opts.$wrap.find('#is_new');
				fn.ordering.$is_new_toggle = fn.opts.$wrap.find('#is_new_toggle');
				fn.ordering.$is_new_toggle.togglebox();

				fn.ordering.$custom_nav.on('click', 'li', fn.ordering.custom_navigate);
				
				fn.ordering.$custom_nav.find('li:first').trigger('click');


				$('.btn-goto-new', fn.opts.$wrap).on('click', fn.ordering.switch2new);

				fn.opts.$wrap.on('blur focus', '.type_float', function(e){
					var v = parseFloat($(this).val());
					if (isNaN(v)) v = '';
					$(this).val(v);
				});

				fn.nav.init();
			},

			custom_navigate: function(e) {
				e.preventDefault();

				$(this).siblings().removeClass('active');
				$(this).addClass('active');

				var $content_set = $(this).closest('.content-set');
				$content_set.find('.div_sub').hide();

				var href = $(this).children('a').attr('href');
				$(href, $content_set).show();
			},

			switch2new: function(e) {
				e.preventDefault();
				$('.btn-goto-new', fn.opts.$wrap).attr('disabled', true);
				ajax.post('tab.orderingView.switch2new', {'id': fn.opts.$wrap.attr('data-tab-id')}, function (json) {
					$('.btn-goto-new', fn.opts.$wrap).removeAttr('disabled');
					fn.setup_curtain(false);
					fn.opts.$wrap.trigger('reload');
				});
			},

			highlight_submenu: function (href, status) {
				if (status == undefined || status != false) {
					status = true;
				}

				var $obj = fn.ordering.$custom_nav.find('a[href="#' + href + '"]');
				var $li = $obj.parent();
				if (status) {
					$li.addClass('missing-info');
					$li.tooltip('enable');
				} else {
					$li.removeClass('missing-info');
					$li.tooltip('disable');
				}
			},

			init_submenu: function () {
				var submenus = ['loc', 'service', 'payment', 'menu', 'email', 'addon'];
				$.each(submenus, function (idx, submenu) {
					fn.ordering.highlight_submenu('div_sub_' + submenu, false);
				});
			}
		},

		nav: {

			init: function () {

				$('#opt_nav_' + fn.ordering.$active_store.val(), fn.opts.$wrap).parent().addClass('active dominent');
				$('#div_' + fn.ordering.$active_store.val(), fn.opts.$wrap).show();

				$('.choice-nav-set li', fn.opts.$wrap).hover(
					function() {
						$(this).siblings('.dominent').css('z-index', '3');
						$(this).addClass('dominent').siblings().removeClass('dominent');
						$(this).tooltip('enable').tooltip('show');
					},
					function() {
						$(this).css('z-index', '3');
						if(!$(this).hasClass('active')) {
							$(this).removeClass('dominent');
							$(this).siblings('.active').addClass('dominent');
							$(this).siblings().not('.dominent').css('z-index', 'inherit');
						}
						$(this).tooltip('hide').tooltip('disable');
					}
				).tooltip({delay: 300, trigger: 'manual'});
				$('.choice-nav-set li .choice-nav', fn.opts.$wrap).on('click', fn.nav.navigate);

			},

			navigate: function(e) {
				e.preventDefault();

				fn.ordering.$active_store.val($(this).attr('ref'));

				$(this).parent().addClass('active dominent').siblings().removeClass('active dominent');
				var $cont_div = $($(this).attr('href'), fn.opts.$wrap);
				$cont_div.siblings().hide();
				$cont_div.show();

				fn.do_monitor();
			}
		},

		loc: {

			$wrap: null,
			$btn_add: null,
			$remove: null,
			$list: null,

			item_maxNo: 0,
			locData: null,
			removedData: null,

			init: function () {

				fn.loc.$wrap = $('#div_sub_loc', fn.opts.$wrap);
				fn.loc.$btn_add = $('.btn-add', fn.loc.$wrap);
				fn.loc.$list = $('#loc_list', fn.loc.$wrap);

				fn.loc.$remove = fn.loc.$wrap.find('.btn-trash');

				$('#buld_fake_link').bind_modal({
					modalId: 'edit_ordering_loc_modal',
					onHide: function () {
						fn.map.disable();
						fn.map.clear();
					},
					onShow: function () {
						fn.opts.$wrap.trigger('closeFlyup');
						plugin.init_uniform($(this.modal).find('.choose-all'));
					},
					onShown: function () {
					}
				});

				$("#button_label").keyup(function(){
					$(".start_order_btn .wireframe span").html(this.value);
				});

				fn.loc.$btn_add.on('click', fn.loc.add);
				fn.loc.$list.on('click', '>li .btn-edit', fn.loc.edit);

				if (fn.opts.data['imported_count'] > 0) {
					notify.success($phrases["build_desc_loc_imported"].replace('{count}', fn.opts.data['imported_count']));
				}

				fn.loc.$remove.bind_confirm({
					name: 'remove-location',
					before: fn.loc.beforeRemove,
					onSubmit: fn.loc.remove
				});

				fn.loc.$wrap.on('change', '.choose-all', fn.loc.chooseAll);
				fn.loc.$wrap.on('update_state', '.choose-all', fn.loc.updateChooseAllState);
				fn.loc.$wrap.on('change', 'input[type="checkbox"].choose', fn.loc.choose);

				fn.loc.$list.sortable({
					items: '.location',
					revert: false,
					opacity: 0.5,
					helper: 'clone',
					handle: '.handle-drag',
					axis: 'y',
					start: function(e, ui) {
						$(ui.item).parent().sortable("refreshPositions");
					},
					stop: function() {
						fn.loc.re_fresh();
					}
				});

				fn.loc.re_render();

				fn.loc.is_valid();

				fn.loc.removedData = [];
			},

			remove_msg: function (e) {
				$('#button_label', fn.loc.$wrap).siblings('.msg').remove();
			},

			is_valid: function () {

				// if (!fn.is_init_done) return true;

				var is_valid = true;
				var is_error = false;
				// fn.ordering.highlight_submenu('div_sub_loc', false);

				fn.loc.remove_msg();

				if (fn.opts.data.is_for_cedar == '1') {

					if ($('#button_label', fn.loc.$wrap).val().trim() == '') {
						// $('#button_label', fn.loc.$wrap).parent().append('<div class="msg right error">' + $phrases.build_label_invalid_name + '</div>');
						// fn.ordering.highlight_submenu('div_sub_loc');
						is_valid = false;
						is_error = true;
					}
				}

				if (!fn.loc.check_data_valid()) {
					// fn.ordering.highlight_submenu('div_sub_loc');
					is_error = true;
					// is_valid = false;
				}

				fn.ordering.highlight_submenu('div_sub_loc', is_error);

				return is_valid;
			},

			check_data_valid: function () {
				var valid = true,
				    $locs = $('li.location', fn.loc.$list);
				
				$.each($locs, function (idx, itm) {
					var id = $(itm).attr('data-id'),
					    loc = fn.loc.locData[id];
					if (loc == undefined) return;

					fn.loc.highlight_location($(itm), false);
					if (fn.loc.check_loc_valid(loc) == false) {
						fn.loc.highlight_location($(itm));
						valid = false;
					}
					/* check if location is changed or not */
					if (fn.opts.data.locs[id] != undefined && doCompare(fn.opts.data.locs[id], loc, true, ['dstOffset', 'changed']))
						fn.loc.locData[id].changed = false;
					else
						fn.loc.locData[id].changed = true;
				});

				return valid;
			},

			check_loc_valid: function (loc) {
				if (!isValidLatLng(loc.latitude, 0)) return false;
				if (!isValidLatLng(loc.longitude, 1)) return false;
				// if (loc.website != '' && !isValidURL(loc.website)) return false;
				if (loc.email != '' && fn.loc_modal.invalid_email(loc.email)) return false;
				// if (loc.telephone != '' && !isValidPhone(loc.telephone)) return false;
				return true;
			},

			highlight_location: function ($loc, status) {
				if (status == undefined || status != false) status = true;
				if (status) {
					$loc.addClass('missing-info');
					$loc.tooltip('enable');
				} else {
					$loc.removeClass('missing-info');
					$loc.tooltip('disable');
				}
			},

			get_display_address: function(location) {

				var title = [];

				if ((location['address_top_row'] && location['address_top_row'].trim() != '') || (location['address_bottom_row'] && location['address_bottom_row'].trim() != '')) {
					if (location['address_top_row'].trim() != '')	title.push(location['address_top_row'].trim());
					if (location['address_bottom_row'].trim() != '')	title.push(location['address_bottom_row'].trim());
				} else if (location['formatted_address'] && location['formatted_address'].trim() != '') {
					title.push(location['formatted_address'].trim());
				} else {
					// Prepare location title.
					if (location.address_1 || location.address_2) {
						temp = location.address_1 + ' ' + location.address_2;
						title.push(temp.trim());
					}
					if (location.city) {
						title.push(location.city);
					}
				}

				var label = title.join(', ');
				if (label == '') label = $phrases["build_label_empty_location"];
				return label;
			},

			re_render: function() {

				fn.loc.$list.html('');

				for (var i=0; i<fn.loc.item_maxNo; i++) {
					if (!fn.loc.locData[i]) continue;
					fn.loc.render(fn.loc.locData[i], false);
				}
				fn.loc.re_fresh ();
			},

			render: function (loc, should_refresh) {

				var $li = fn.loc.render_atom(loc);
				$li.appendTo(fn.loc.$list);
				plugin.init_uniform($li);

				if (should_refresh) fn.loc.re_fresh ();
			},

			render_atom: function (loc) {

				var $li = $('<li class="location" data-id="' + loc.ref_id + '" id="location_' + loc.ref_id + '">');
				
				$li.append('<input data-val-skip="true" class="choose" type="checkbox" />');
				$li.append('<i class="handle-drag fa fa-arrows"></i>');
				$li.append('<div class="title">' + escapeHtml(fn.loc.get_display_address(loc)) + '</div>');

				$li.append('<button class="btn-edit btn btn-dashboard btn-white"><i class="iconba icon-edit-single"></i></button>');

				$li.tooltip({placement: 'top', title: $phrases.build_tip_missing_incorrect_info, animation: false, trigger: 'manual'}).clingTooltip();

				return $li;
			},

			re_fresh: function() {

				fn.loc.$wrap.find('span.count').html($phrases["build_content_location_count"].replace('{count}', fn.loc.$list.find('li.location').length));
				var total_cn = fn.loc.$list.find('li.location').length;
				$.each(fn.loc.$list.find('li.location input[type="checkbox"]'), function (idx, itm) {

					// Update seq and section
					var $li = $(itm).parents('li.location');
					var	id = $li.attr('data-id');
					fn.loc.locData[id]['seq'] = total_cn - idx;
				});

				fn.do_monitor();
			},

			add: function(e) {
				fn.loc_modal.add();
			},

			edit: function(e) {
				var idv = $(this).parent().attr('data-id');
				fn.loc_modal.edit(fn.loc.locData[idv]);
			},

			chooseAll: function (e) {

				var $choose = fn.loc.$list.find('input[type="checkbox"].choose');
				$choose.prop('checked', $(this).find('input').is(':checked'));
				$.uniform.update($choose);

				$(this).trigger('update_state');
			},

			updateChooseAllState: function (e) {

				var $choose = fn.loc.$list.find('input[type="checkbox"].choose');
				var count = $choose.length,
					activeCount = $choose.filter(':checked').length,
					$chooseAllCheck = fn.loc.$wrap.find('input[type="checkbox"].check-all');

				if ((count > 0) && (activeCount == count)) {
					$chooseAllCheck.prop('checked', true);
					// $(this).find('.checker').toggleClass('partial', count != activeCount);
				} else {
					$chooseAllCheck.prop('checked', false);
				}


				if (activeCount) {
					fn.loc.$remove.removeAttr('disabled');
				} else {
					fn.loc.$remove.attr('disabled', true);
				}

				$.uniform.update($chooseAllCheck);
			},

			choose: function(e) {
				var $chooseAllCheck = fn.loc.$wrap.find('input[type="checkbox"].check-all');
				$chooseAllCheck.trigger('update_state');
			},


			beforeRemove: function () {

				var $choose = fn.loc.$list.find('li.location input[type="checkbox"]');
					$activeItems = $choose.filter(':checked');

				if (!$activeItems.length) {
					return false;
				}

				$(this.modal).trigger('updateCheckList', [$.map($activeItems, function(itm) {

					var $li = $(itm).parents('li.location').eq(0);
					var idv = $li.attr('data-id');

					var loc_title = fn.loc.get_display_address(fn.loc.locData[idv]);
					var lbl = escapeHtml(loc_title);

					return '<li>'/* + indv + '.'*/ + lbl + '</li>';

				}).join('')]);
				return true;
			},

			remove: function () {
				var $choose = fn.loc.$list.find('li.location input[type="checkbox"]');
					$checked = $choose.filter(':checked');

				// Remove events.
				$.each($checked, function (idx, itm) {
					var $li = $(this).parents('li.location');
					var ind = $li.attr("data-id");

					$li.remove();
					if (fn.loc.locData[ind].id != '0') {
						fn.loc.removedData.push(fn.loc.locData[ind].id);
					}
					delete fn.loc.locData[ind];
				});

				fn.loc.choose();
				fn.loc.re_fresh();
			},

			/* get changed data */
			getChangedData: function () {
				var changedData = [];
				$.each(fn.loc.locData, function (idx, itm) {
					if (itm.changed != undefined && itm.changed) changedData.push(itm);
				});
				return changedData;
			}
		},

		loc_modal: {

			$modal: null,
			$locationInfo: null,
			$mask: null,

			$baseInfo: null,
			$addr1: null,
			$addr2: null,
			$site: null,
			$email: null,

			$lat: null,
			$lng: null,
			$distType: null,

			$formatted: null,
			$city: null,
			$state: null,
			$country: null,
			$zip: null,

			$title: null,
			$save: null,
			$cancel: null,

			$timezone: null,

			mapping: {
				'#addr_top': 'address_top_row',
				'#addr_bottom': 'address_bottom_row',
				'#addr_1': 'address_1',
				'#addr_2': 'address_2',
				'#city': 'city',
				'#state': 'state',
				'#zip': 'zip',
				// '#site': 'website',
				'#email': 'email',
				// '#phone': 'telephone',
				'#addr': 'formatted_address',
				'#lat': 'latitude',
				'#lng': 'longitude',
				'#dist_type': 'distance_type',
				'#timezone': 'timezone',
			},

			currentEditId: false,

			init: function () {

				fn.loc_modal.$modal = $('#edit_ordering_loc_modal');
				fn.loc_modal.$locationInfo = fn.loc_modal.$modal.find('.modal-body .map-wrapper');
				fn.loc_modal.$mask = fn.loc_modal.$locationInfo.find('.mask');
				
				fn.loc_modal.$title = fn.loc_modal.$modal.find('.modal-header .modal-title');

				// fn.loc_modal.$site = fn.loc_modal.$modal.find('#site');
				// fn.loc_modal.$phone = fn.loc_modal.$modal.find('#phone');
				fn.loc_modal.$email = fn.loc_modal.$modal.find('#email');
				
				fn.loc_modal.$timezone = fn.loc_modal.$modal.find('#timezone');
				
				fn.loc_modal.$baseInfo = fn.loc_modal.$modal.find('.modal-body .base-info');

				fn.loc_modal.$addr1 = fn.loc_modal.$baseInfo.find('#addr_1');
				fn.loc_modal.$addr2 = fn.loc_modal.$baseInfo.find('#addr_2');

				fn.loc_modal.$formatted = fn.loc_modal.$baseInfo.find('#formatted_address');
				fn.loc_modal.$city = fn.loc_modal.$baseInfo.find('#city');
				fn.loc_modal.$state = fn.loc_modal.$baseInfo.find('#state');
				fn.loc_modal.$country = fn.loc_modal.$baseInfo.find('#country');
				fn.loc_modal.$zip = fn.loc_modal.$baseInfo.find('#zip');

				fn.loc_modal.$lat = fn.loc_modal.$locationInfo.find('#lat');
				fn.loc_modal.$lng = fn.loc_modal.$locationInfo.find('#lng');

				fn.loc_modal.$distType = fn.loc_modal.$modal.find('#dist_type');
				fn.loc_modal.$addr_top = fn.loc_modal.$modal.find('#addr_top');
				fn.loc_modal.$addr_bottom = fn.loc_modal.$modal.find('#addr_bottom');


				fn.loc_modal.$save = fn.loc_modal.$modal.find('.modal-footer .btn-save');
				fn.loc_modal.$cancel = fn.loc_modal.$modal.find('.modal-footer .btn-no');

				fn.loc_modal.$save.on('click', fn.loc_modal.save);

				fn.loc_modal.$mask.on('click', fn.map.enable);

				fn.loc_modal.$modal.on('focus keyup change blur', 'input, select', fn.loc_modal.inner_monitor);

				fn.loc_modal.$timezone.off('change');
				fn.loc_modal.$timezone.on('change', fn.loc_modal.refreshTimezones);

				// init inner objs
				fn.map.init();
				fn.loc_modal.init_dp();


				// ------------------------------------------------------------
				// Timezone Part Initialize
				// ------------------------------------------------------------

				fn.loc_modal.$modal.find('#timezone-toggler').togglebox().on('changed', function() {
					if (fn.loc_modal.$modal.find('#timezone-toggler').data('checked')) {
						$("#div_timezone_settings", fn.loc_modal.$modal).stop(true, true).slideUp();
						// $('#timezone', fn.loc_modal.$modal).val(default_timezone).trigger('change');
					} else {
						$("#div_timezone_settings", fn.loc_modal.$modal).stop(true, true).slideDown();
					}

					fn.loc_modal.inner_monitor();
				});


				// ------------------------------------------------------------
				// Location Import Part Initialize
				// ------------------------------------------------------------
				
				fn.loc_modal.$modal.find('#loc-toggler').togglebox().on('changed', function() {
					if (fn.loc_modal.$modal.find('#loc-toggler').data('checked')) {
						$("#div_imported_loc", fn.loc_modal.$modal).stop(true, true).slideDown();
					} else {
						$("#div_imported_loc", fn.loc_modal.$modal).stop(true, true).slideUp();
					}
					fn.loc_modal.inner_monitor();
				});

				$('#imported_loc').on('change', fn.loc_modal.address_imported);
				fn.loc_modal.re_render_locs();
				


				// ------------------------------------------------------------
				// Open Time Set initialize
				// ------------------------------------------------------------
				fn.loc_modal.$modal.on('click', '.btn-add-customtime', function(e){
					var $row = $('<div class="row-sm more-times"></div>');
					$row.append($('#open_time_model', fn.loc_modal.$modal).html());
					$row.appendTo($(this).parent().siblings('.day_value'));
					fn.loc_modal.init_dp($row);
					fn.loc_modal.inner_monitor();
				});

				fn.loc_modal.$modal.on('click', '.more-times .btn-del', function(e){
					$(this).parents('.more-times').fadeOut(function(){
						$(this).remove();
						fn.loc_modal.inner_monitor();
					});
				});

				$('.time-toggler', fn.loc_modal.$modal).togglebox().on('changed', function() {
					var $p = $(this).parents('.row-sm').eq(0);
					if($(this).data('checked')) {
						$('.btn-add-customtime, .day_value > div', $p).show();
					} else {
						$('.btn-add-customtime, .day_value > div', $p).hide();
					}
					fn.loc_modal.inner_monitor();
				}).toggleboxSet(true);
				// --------------------------------------------------------------


				plugin.init_selectbox({
					selector: fn.loc_modal.$modal.find(".select2")
				});
			},

			init_dp: function($wrapper) {

				if (!$wrapper) $wrapper = fn.loc_modal.$modal;
				
				var timeFormat = 'HH:mm';
				if ( isLocationUS == '1' ) {
					timeFormat = 'hh:mm A';
				}

				$('div.opentime-from', $wrapper).each(function(i, o){

					if($(o).data("DateTimePicker")) {
						$(o).data("DateTimePicker").destroy();
					}

					$(o).datetimepicker({
						'format': timeFormat,
						'useCurrent': 'hour' //Important! See issue #1075
					});

					$(o).on("dp.change", function(e){
						if (e.date == null) return;
						var $p = $(this).parents('.row-sm').eq(0);
						var $to = $('.opentime-to', $p).eq(0);

						var to_time = $to.data('DateTimePicker').date();
						if ((to_time == null) || (to_time < e.date)) {
							$to.data('DateTimePicker').date(e.date)
						}
					});

				});


				$('div.opentime-to', $wrapper).each(function(i, o){

					if($(o).data("DateTimePicker")) {
						$(o).data("DateTimePicker").destroy();
					}

					$(o).datetimepicker({
						'format': timeFormat,
						'useCurrent': 'hour' //Important! See issue #1075
					});
					$(o).on("dp.change", function(e){
						if (e.date == null) return;
						var $p = $(this).parents('.row-sm').eq(0);
						var $from = $('.opentime-from', $p).eq(0);

						var from_time = $from.data('DateTimePicker').date();
						if ((from_time == null) || (from_time > e.date)) {
							$from.data('DateTimePicker').date(e.date)
						}
					});
				});
			},

			clear_dp: function($wrapper, is_init_value) {
				if (!$wrapper) $wrapper = fn.loc_modal.$modal;

				$('.opentime-set > .row-sm', fn.loc_modal.$modal).attr('data-id', '');

				$('div.opentime-from', $wrapper).each(function(i, o) {
					if ($(o).data("DateTimePicker")) {
						$(o).data("DateTimePicker").clear();
						if (is_init_value) {
							$(o).data("DateTimePicker").date('07:00');
						}
					}
				});

				$('div.opentime-to', $wrapper).each(function(i, o) {
					if ($(o).data("DateTimePicker")) {
						$(o).data("DateTimePicker").clear();
						if (is_init_value) {
							$(o).data("DateTimePicker").date('17:00');
						}
					}
				});
			},

			address_imported: function() {
				var loc_id = $('#imported_loc').val();
				if ((loc_id == null) || (loc_id == '0')) return;

				fn.loc_modal.$addr_top.val(fn.opts.data.app_locs[loc_id]['address_top_row']);
				fn.loc_modal.$addr_bottom.val(fn.opts.data.app_locs[loc_id]['address_bottom_row']);
				fn.loc_modal.$addr1.val(fn.opts.data.app_locs[loc_id]['address_1']);
				fn.loc_modal.$addr2.val(fn.opts.data.app_locs[loc_id]['address_2']);
				fn.loc_modal.$formatted.val(fn.opts.data.app_locs[loc_id]['formatted_address']);
				fn.map.$addr.val(fn.opts.data.app_locs[loc_id]['formatted_address']);
				fn.loc_modal.$city.val(fn.opts.data.app_locs[loc_id]['city']);
				fn.loc_modal.$state.val(fn.opts.data.app_locs[loc_id]['state']);
				fn.loc_modal.$country.val(fn.opts.data.app_locs[loc_id]['country']);
				fn.loc_modal.$zip.val(fn.opts.data.app_locs[loc_id]['zip']);
				fn.loc_modal.$lat.val(fn.opts.data.app_locs[loc_id]['latitude']);
				fn.loc_modal.$lng.val(fn.opts.data.app_locs[loc_id]['longitude']);
				// fn.loc_modal.$site.val(fn.opts.data.app_locs[loc_id]['website']);
				// fn.loc_modal.$phone.val(fn.opts.data.app_locs[loc_id]['telephone']);
				// fn.loc_modal.$email.val(fn.opts.data.app_locs[loc_id]['email']);
				// fn.map.enable();
			},

			re_render_locs: function () {

				$('#imported_loc', fn.loc_modal.$modal).html('');

				$('#imported_loc', fn.loc_modal.$modal).append('<option value="0">' + $phrases["build_label_select_location"] + '</option>');
				for (var keyv in fn.opts.data.app_locs) {
					if (fn.opts.data.app_locs[keyv] == undefined || typeof fn.opts.data.app_locs[keyv] != 'object') continue;

					var label = fn.opts.data.app_locs[keyv]['address_string'];
					if (label == '') label = $phrases["build_label_no_label"];
					$('#imported_loc').append('<option value="' + keyv + '">' + escapeHtml(label) + '</option>');
				}

				plugin.init_selectbox({
					selector: $('#imported_loc', fn.loc_modal.$modal)
				});
			},

			switchEditType: function (isAdd) {
				var dataLabel = isAdd ? 'data-add-label' : 'data-edit-label';
				fn.loc_modal.$title.html(fn.loc_modal.$title.attr(dataLabel));
				fn.loc_modal.$save.html(fn.loc_modal.$save.attr(dataLabel));
			},
			
			refreshTimezones: function() {
				
				var $parentTimezone = fn.loc_modal.$timezone.parent();
				
				$parentTimezone.css('position', 'relative');
				if ( $parentTimezone.find('.loading').length < 1 ) {
					$parentTimezone.prepend('<span class="loading" style="position:absolute; left:0; top:0; width:100%; height:100%; background-color:#fff; opacity:0.5; z-index:1; cursor:wait;"></span>');
				}

				ajax.post('tab.eventsManagerView.load_timezones', {timezone: fn.loc_modal.$timezone.val()}, function(res) {
					if ( res.length > 0 ) {
						fn.loc_modal.$timezone.select2('destroy');
						fn.loc_modal.$timezone.html('');

						// Timezone
						for ( var ti = 0; ti < res.length; ti++ ) {
							fn.loc_modal.$timezone.append('<option value="' + res[ti].id + '"' + (res[ti].selected == '1' ? ' selected' : '') + '>' + res[ti].name + '</option>');
						}
						fn.loc_modal.$timezone.select2();
					}
					$parentTimezone.find('.loading').remove();
				});

			},

			add : function () {

				fn.loc_modal.switchEditType(true);
				fn.loc_modal.currentEditId = false;

				fn.loc_modal.$modal.find('input[type=text]').val('');
				fn.loc_modal.$modal.find('input[type=hidden]').val('');

				$('#lat', fn.loc_modal.$modal).val('0');
				$('#lng', fn.loc_modal.$modal).val('0');
				$('.time-toggler', fn.loc_modal.$modal).toggleboxSet(true).trigger('changed');
				$('.more-times', fn.loc_modal.$modal).remove();
				fn.loc_modal.clear_dp(false, true);

				$('#dist_type', fn.loc_modal.$modal).val('0').trigger('change');
				$('#timezone-toggler').toggleboxSet(false).trigger('changed');

				$('#loc-toggler').toggleboxSet(false).trigger('changed');
				$('#imported_loc', fn.loc_modal.$modal).val(0).trigger("change");

				fn.loc_modal.$modal.modal('show');
				fn.loc_modal.inner_monitor();
			},

			edit: function (data) {

				fn.loc_modal.switchEditType();
				fn.loc_modal.currentEditId = data.ref_id;

				fn.loc_modal.$modal.find('input[type=text]').val('');
				$('.time-toggler', fn.loc_modal.$modal).toggleboxSet(true).trigger('changed');
				$('.more-times', fn.loc_modal.$modal).remove();
				fn.loc_modal.clear_dp();

				$('#imported_loc', fn.loc_modal.$modal).val(data['app_location_id']).trigger("change");
				$('#loc-toggler', fn.loc_modal.$modal).toggleboxSet(data['app_location_id']!='0');

				for (ky in fn.loc_modal.mapping) {
					$(ky, fn.loc_modal.$modal).val(data[fn.loc_modal.mapping[ky]]);
				}
				$('#dist_type', fn.loc_modal.$modal).trigger('change');
				$('#timezone', fn.loc_modal.$modal).trigger('change');
				$('#timezone-toggler').toggleboxSet(data['use_global_timezone'] == '1').trigger('changed');
				// if (data.timezone == default_timezone) {
				// 	$('#timezone-toggler').toggleboxSet(true).trigger('changed');
				// } else {
				// 	$('#timezone-toggler').toggleboxSet(false).trigger('changed');
				// }

				var ind = 0;
				var kv = '';
				for (var kv = 0; kv < data.ots.length; kv++) {

					if (data.ots[kv] === false) {
						data.ots[kv] = {
							'id': '0',
							'open_time': "" + 7*60,
							'close_time': "" + 17*60,
							'more_time':[],
							'is_active': "1"
						};
					}

					var $p = $('.opentime-set > .row-' + ind, fn.loc_modal.$modal);
					$p.attr('data-id', '0');

					if (data.ots[kv]) {

						$p.attr('data-id', data.ots[kv]['id']);
						// if (data.ots[kv]['open_time'] == data.ots[kv]['close_time']) {
						// if (data.ots[kv]['is_active'] == '0') {
						

						$('.opentime-from', $p).data("DateTimePicker").date(convert_mins(data.ots[kv]['open_time']));
						$('.opentime-to', $p).data("DateTimePicker").date(convert_mins(data.ots[kv]['close_time']));

						for (var i=0; i<data.ots[kv]['more_time'].length; i++) {
							var $row = $('<div class="row-sm more-times"></div>');
							$row.append($('#open_time_model', fn.loc_modal.$modal).html());
							$row.appendTo($('.day_value', $p));
							fn.loc_modal.init_dp($row);

							$('div.opentime-from', $row).data("DateTimePicker").date(convert_mins(data.ots[kv]['more_time'][i][0]));
							$('div.opentime-to', $row).data("DateTimePicker").date(convert_mins(data.ots[kv]['more_time'][i][1]));
						}

						if ((data.ots[kv]['open_time'] == data.ots[kv]['close_time']) || (data.ots[kv]['is_active'] == '0')) {
							$('.time-toggler', $p).toggleboxSet(false).trigger('changed');
						} else {
							$('.time-toggler', $p).toggleboxSet(true).trigger('changed');
						}
						
					}

					ind = ind + 1;
				}

				fn.loc_modal.$modal.modal('show');
				fn.loc_modal.inner_monitor();
			},

			inputData: function() {
				var data = {};
				if (fn.loc_modal.currentEditId !== false) {
					data = jQuery.extend(true, {}, fn.loc.locData[fn.loc_modal.currentEditId]);
				}

				for (kv in fn.loc_modal.mapping) {
					data[fn.loc_modal.mapping[kv]] = $(kv, fn.loc_modal.$modal).val();
					if (kv == '#timezone') {
						data['use_global_timezone'] = '0';
						if ($('.timezone-toggler', fn.loc_modal.$modal).data('checked')) {
							data[fn.loc_modal.mapping[kv]] = default_timezone;
							data['use_global_timezone'] = '1';
						}
					}
				}
				data['dstOffset'] = parseFloat(fn.opts.data.timezones[data['timezone']][0]);

				if ($('#loc-toggler', fn.loc_modal.$modal).data('checked')) {
					data['app_location_id'] = $('#imported_loc', fn.loc_modal.$modal).val();
				} else {
					data['app_location_id'] = '0';
				}
				data['ots'] = []; // Let's initialize open time
				$('.opentime-set>.row-sm', fn.loc_modal.$modal).each(function(i, o){
					data['ots'][i] = {
						'id': $(o).attr('data-id'),
						'open_time': "" + convert_mins($('input.opentime-from', $(o)).val(), true),
						'close_time': "" + convert_mins($('input.opentime-to', $(o)).val(), true, $('.time-toggler', $(o)).data('checked')),
						'more_time':[],
						'is_active': $('.time-toggler', $(o)).data('checked')?'1':'0'
					};
					
					$('.more-times', $(o)).each(function(j, p){
						data['ots'][i]['more_time'].push([
							"" + convert_mins($('input.opentime-from', $(p)).val(), true),
							"" + convert_mins($('input.opentime-to', $(p)).val(), true, true)
						]);
					});

					/*
					if(!$('.time-toggler', $(o)).data('checked')) {
						data['ots'][i]['open_time'] = "0";
						data['ots'][i]['close_time'] = "0";
					} else {
						
					}
					*/
				});

				return data;
			},

			save: function() {

				var data = fn.loc_modal.inputData();

				data.changed = true;

				if (fn.loc_modal.currentEditId !== false) { // Edit case
					var $li = fn.loc.render_atom(data);
					$li.find('.choose').prop('checked', fn.loc.$list.find('#location_' + fn.loc_modal.currentEditId + ' .choose').is(':checked'));
					$li.insertAfter(fn.loc.$list.find('#location_' + fn.loc_modal.currentEditId));
					fn.loc.$list.find('#location_' + fn.loc_modal.currentEditId).eq(0).remove();
					plugin.init_uniform($li);
				} else {
					fn.loc_modal.currentEditId = fn.loc.item_maxNo;
					data['ref_id'] = fn.loc_modal.currentEditId;
					data['id'] = '0';
					fn.loc.item_maxNo = fn.loc.item_maxNo + 1;

					fn.loc.render(data);
				}
				fn.loc.locData[fn.loc_modal.currentEditId] = data;

				fn.loc_modal.$modal.modal('hide');

				fn.loc.re_fresh();
				fn.menu.re_fresh_menu_locations();
				// fn.menu.re_fresh();
				// fn.do_monitor();

				fn.loc.updateChooseAllState();
			},

			invalid_email: function (value) {
				var invalid = false;
				var emails = value.split(',');
				for (var i = 0; i < emails.length; i++) {
					email = emails[i].trim();
					if (email == '' || !isValidEmail(email)) {
						invalid = true;
						break;
					}
				}
				return invalid;
			},
			invalid_input: function (show_error) {
				if (show_error == undefined) show_error = false;

				var email = fn.loc_modal.$email.val(),
				    // url = fn.loc_modal.$site.val(),
				    // phone = fn.loc_modal.$phone.val(),
				    email_invalid = (email != '' && fn.loc_modal.invalid_email(email)),
				    // url_invalid = (url != '' && !isValidURL(url)),
				    // phone_invalid = (phone != '' && !isValidPhone(phone)),
				    invalid = false;
				// if (url_invalid) invalid = true;
				// if (email_invalid) invalid = true;
				// if (phone_invalid) invalid = true;

				if (show_error) {
					fn.loc_modal.$modal.find('.msg.error').remove();
					/*if (url_invalid) {
						fn.loc_modal.$site.parent().append('<div class="msg right error">' + $phrases.build_modal_url_invalid + '</div>');
					}*/
					if (email_invalid) {
						fn.loc_modal.$email.parent().append('<div class="msg right error">' + $phrases.build_label_email_invalid + '</div>');
					}
					/*if (phone_invalid) {
						fn.loc_modal.$phone.parent().append('<div class="msg right error">' + $phrases.build_label_telephone_invalid + '</div>');
					}*/
				}

				return invalid;
			},

			get_default_ots: function () {
				return [
					{"id":"","open_time":"420","close_time":"1020","more_time":[],"is_active":"1"},
					{"id":"","open_time":"420","close_time":"1020","more_time":[],"is_active":"1"},
					{"id":"","open_time":"420","close_time":"1020","more_time":[],"is_active":"1"},
					{"id":"","open_time":"420","close_time":"1020","more_time":[],"is_active":"1"},
					{"id":"","open_time":"420","close_time":"1020","more_time":[],"is_active":"1"},
					{"id":"","open_time":"420","close_time":"1020","more_time":[],"is_active":"1"},
					{"id":"","open_time":"420","close_time":"1020","more_time":[],"is_active":"1"}
				];
			},

			inner_monitor: function() {

				var is_valid = fn.map.latlng.is_valid();

				var loc = {};
				if (fn.loc_modal.currentEditId === false) {
					for (kv in fn.loc_modal.mapping) {
						loc[fn.loc_modal.mapping[kv]] = '';
						// if (kv == '#lat' || kv == '#lng') loc[fn.loc_modal.mapping[kv]] = '0';
						if ($.inArray(kv, ['#lat', '#lng', '#dist_type']) >= 0)
							loc[fn.loc_modal.mapping[kv]] = '0';
					}
					loc['app_location_id'] = '0';
					loc['ots'] = fn.loc_modal.get_default_ots();
					loc['use_global_timezone'] = '0';
					loc['timezone'] = default_timezone;
				} else {
					loc = fn.loc.locData[fn.loc_modal.currentEditId];
				}
				var new_loc = fn.loc_modal.inputData();
				// var is_same = deepCompare(loc, new_loc);
				var is_same = doCompare(loc, new_loc, false, ['dstOffset']);

				// check validation
				var invalid = fn.loc_modal.invalid_input(true);
				// var invalid = false;

				// Check for data change
				if (!invalid && is_valid && !is_same) {
					fn.loc_modal.$save.removeAttr('disabled');
				} else {
					fn.loc_modal.$save.attr('disabled', true);
				}
			}
		},

		service: {
			$wrap: null,
			radius: -1,
			delivery_minimum: 0,
			free_delivery_amount : 0,
			convenience_fee: 0,
			// required_fields: {
			// 	'#lead_time': $phrases.build_label_input_value,
			// 	'#delivery_radius': $phrases.build_label_input_value,
			// 	'#delivery_minimum': $phrases.build_label_input_value,
			// 	'#delivery_fee': $phrases.build_label_input_value,
			// 	'#free_delivery_amount': $phrases.build_label_input_value,
			// 	'#convenience_fee': $phrases.build_label_input_value
			// },

			init: function() {
				
				fn.service.$wrap = $('#div_sub_service', fn.opts.$wrap);
				$('.togglebox', fn.service.$wrap).togglebox();
				
				var is_delivery_checked = $('#is_delivery_toggle').hasClass('checked');

				// CV-2900
				fn.delivery_toggles_handle = function (is_delivery_checked) {
					if(is_delivery_checked == false)
					{
						$('#is_delivery_address_validation_toggle').disableTogglebox();
						$('#delivery_fee_taxable_toggle').disableTogglebox();
					}
					else
					{
						$('#is_delivery_address_validation_toggle').enableTogglebox();
						$('#delivery_fee_taxable_toggle').enableTogglebox();

						if (fn.opts.data.is_for_cedar == '1') {
							$('#is_delivery_address_validation_toggle', fn.service.$wrap).on('changed', function() { // wrapper corrected
								$('#delivery_radius', fn.service.$wrap).prop('disabled', !$(this).data('checked'));
								$('#delivery_radius_type', fn.service.$wrap).prop('disabled', !$(this).data('checked'));
							}).trigger('changed');
						}
					}
				}

				fn.delivery_toggles_handle(is_delivery_checked);

				$('#delivery_radius', fn.service.$wrap).on('input', function () {
					var radius = parseFloat($('#delivery_radius', fn.service.$wrap).val());
					if ($('#delivery_radius_type', fn.service.$wrap).val() == '1') {
						radius = radius * 1.609344;
					}
					if (fn.service.radius != radius) fn.service.radius = radius;
				});
				$('#delivery_radius_type', fn.service.$wrap).select2({minimumResultsForSearch: Infinity}).on('change', function () {
					if (fn.service.radius < 0) return;
					var val = $(this).val();
					var radius = 0;
					if (val == '0') {
						radius = fn.service.radius * 1;
					} else {
						radius = fn.service.radius / 1.609344;
					}
					/*var radius = $('#delivery_radius', fn.service.$wrap).val();
					if (val == '0') {
						radius = radius * 1.609344;
					} else {
						radius = radius / 1.609344;
					}*/
					radius = radius.toFixed(2).toString();
					radius = radius.replace('.00', '');
					$('#delivery_radius', fn.service.$wrap).val(radius);
				});
				// $('#delivery_radius_type', fn.service.$wrap).trigger('change');
				fn.service.init_radius();


				// CV-2797
				// CV-2900
				$('#is_delivery_toggle').click(function() {
					var is_delivery_checked = $(this).hasClass('checked');
					fn.delivery_toggles_handle(is_delivery_checked);
				});
				$('#is_delivery_toggle', fn.service.$wrap).on('changed', function() {
					// disabling toggleboxes
					fn.delivery_toggles_handle(is_delivery_checked);
					// disabling other elements of the form
					$('#delivery_days', fn.service.$wrap).prop('disabled', !$(this).data('checked'));
					$('#delivery_radius', fn.service.$wrap).prop('readonly', !$(this).data('checked'));
					$('#delivery_radius_type', fn.service.$wrap).prop('disabled', !$(this).data('checked'));
					$('#delivery_minimum', fn.service.$wrap).prop('disabled', !$(this).data('checked'));
					$('#delivery_fee', fn.service.$wrap).prop('disabled', !$(this).data('checked'));
					$('#free_delivery_amount', fn.service.$wrap).prop('disabled', !$(this).data('checked'));
				}).trigger('changed');
				
				
				$('#delivery_minimum', fn.service.$wrap).focusout(function(){
					fn.service.set_delivery_price();
				});
				$('#free_delivery_amount', fn.service.$wrap).focusout(function(){
					fn.service.set_delivery_price();
				});
				$('#convenience_fee', fn.service.$wrap).focusout(function(){
					fn.service.set_delivery_price();
				});
				
				$('#is_takeout_toggle', fn.service.$wrap).on('changed', function() {
					$('#takeout_days', fn.service.$wrap).prop('disabled', !$(this).data('checked'));
				}).trigger('changed');

				fn.service.is_valid();
				fn.service.set_delivery_price();
				// fn.service.$wrap.on('focus change keyup', Object.keys(fn.service.required_fields).join(','), function () {
				// 	$(this).siblings('.msg.error').remove();
				// 	if ($(this).val() == '') {
				// 		$(this).parent().append('<div class="msg left error">' + $phrases.build_label_input_value + '</div>');
				// 	}
				// });

			},

			init_radius: function () {
				var type = $('#delivery_radius_type', fn.service.$wrap).val();
				var radius = parseFloat($('#delivery_radius', fn.service.$wrap).val());
				fn.service.radius = radius;
				if (type == '1') {
					radius /= 1.609344;
					radius = radius.toFixed(2).toString();
					radius = radius.replace('.00', '');
					$('#delivery_radius', fn.service.$wrap).val(radius).attr('data-val', radius);
				}
			},
			set_delivery_price: function() {
				$delivery_minimum = $('#delivery_minimum', fn.service.$wrap).val();
				$free_delivery_amount = $('#free_delivery_amount', fn.service.$wrap).val();
				$convenience_fee = $('#convenience_fee', fn.service.$wrap).val();
				if ( $.inArray(fn.payment.current_currency_value, fn.non_decimal_currency) !== -1 ) {
					fn.service.delivery_minimum = Math.round($delivery_minimum);
					fn.service.free_delivery_amount = Math.round($free_delivery_amount);
					fn.service.convenience_fee = Math.round($convenience_fee);
				} else {
					fn.service.delivery_minimum = $delivery_minimum; 
					fn.service.free_delivery_amount = $free_delivery_amount; 
					fn.service.convenience_fee = $convenience_fee;
				} 
								   
				$('#delivery_minimum', fn.service.$wrap).val(fn.service.delivery_minimum); 
				$('#free_delivery_amount', fn.service.$wrap).val(fn.service.free_delivery_amount); 
			},
			remove_msg: function(e) {
				// $('#lead_time', fn.service.$wrap).siblings('.msg').remove();
				fn.service.$wrap.find('.msg.error').remove();
			},

			is_valid: function() {

				// if (!fn.is_init_done) return true;

				var is_valid = true;
				// fn.ordering.highlight_submenu('div_sub_service', false);

				fn.service.remove_msg();

				var is_d = $('#is_delivery', fn.service.$wrap).prop('checked'),
				    is_d_a_v = $('#is_delivery_address_validation', fn.service.$wrap).prop('checked');

				// check lead time
				var min_lead_time = parseFloat($('#lead_time', fn.service.$wrap).val()),
				    delivery_radius = parseFloat($('#delivery_radius', fn.service.$wrap).val()),
				    delivery_minimum = parseFloat($('#delivery_minimum', fn.service.$wrap).val()),
				    delivery_fee = parseFloat($('#delivery_fee', fn.service.$wrap).val()),
				    free_delivery_amt = parseFloat($('#free_delivery_amount', fn.service.$wrap).val()),
				    convenience_fee = parseFloat($('#convenience_fee', fn.service.$wrap).val());
				if (isNaN(min_lead_time)) min_lead_time = 0;
				if (isNaN(delivery_radius)) delivery_radius = -1;
				if (isNaN(delivery_minimum)) delivery_minimum = -1;
				if (isNaN(delivery_fee)) delivery_fee = -1;
				if (isNaN(free_delivery_amt)) free_delivery_amt = -1;
				if (isNaN(convenience_fee)) convenience_fee = -1;
				if (min_lead_time < 5) {
					// if ($('#lead_time', fn.service.$wrap).val() == '')
					// 	$('#lead_time', fn.service.$wrap).parent().append('<div class="msg left error">' + $phrases.build_label_input_value + '</div>');
					// else
					//$('#lead_time', fn.service.$wrap).parent().append('<div class="msg left error">' + $phrases.build_desc_min_lead_time + '</div>');
					is_valid = false;
				}
				if (is_d && is_d_a_v && delivery_radius < 0) {
					// if ($('#delivery_radius', fn.service.$wrap).val() == '')
					// 	$('#delivery_radius', fn.service.$wrap).parent().append('<div class="msg left error">' + $phrases.build_label_input_value + '</div>');
					// else
					$('#delivery_radius', fn.service.$wrap).parent().append('<div class="msg left error">' + $phrases.build_label_invalid_value + '</div>');
					is_valid = false;
				}
				if (is_d && delivery_minimum < 0) {
					// if ($('#delivery_minimum', fn.service.$wrap).val() == '')
					// 	$('#delivery_minimum', fn.service.$wrap).parent().append('<div class="msg left error">' + $phrases.build_label_input_value + '</div>');
					// else
						$('#delivery_minimum', fn.service.$wrap).parent().append('<div class="msg left error">' + $phrases.build_label_invalid_value + '</div>');
					is_valid = false;
				}
				if (is_d && delivery_fee < 0) {
					// if ($('#delivery_fee', fn.service.$wrap).val() == '')
					// 	$('#delivery_fee', fn.service.$wrap).parent().append('<div class="msg left error">' + $phrases.build_label_input_value + '</div>');
					// else
						$('#delivery_fee', fn.service.$wrap).parent().append('<div class="msg left error">' + $phrases.build_label_invalid_value + '</div>');
					is_valid = false;
				}
				if (is_d && free_delivery_amt < 0) {
					// if ($('#free_delivery_amount', fn.service.$wrap).val() == '')
					// 	$('#free_delivery_amount', fn.service.$wrap).parent().append('<div class="msg left error">' + $phrases.build_label_input_value + '</div>');
					// else
						$('#free_delivery_amount', fn.service.$wrap).parent().append('<div class="msg left error">' + $phrases.build_label_invalid_value + '</div>');
					is_valid = false;
				}
				if (convenience_fee < 0) {
					// $('#convenience_fee', fn.service.$wrap).parent().append('<div class="msg left error">' + $phrases.build_label_invalid_value + '</div>');
					// is_valid = false;
					$('#convenience_fee', fn.service.$wrap).val('');
				}
				
				// if (!is_valid) {
				// 	fn.ordering.highlight_submenu('div_sub_service');
				// }
				fn.ordering.highlight_submenu('div_sub_service', !is_valid);

				return is_valid;
			}
		},

		payment: {
			$wrap: null,
			$btn_add: null,
			$remove: null,
			$tax_wrap: null,
			$list: null,
			is_support_spreedly: 0,
			payment_gateway: 0,

			taxData: null,
			item_maxNo: 0,
			current_currency_value: '',
			init: function() {

				fn.payment.$wrap = $('#div_sub_payment', fn.opts.$wrap);
				fn.payment.$tax_wrap = $('#tax_wrapper', fn.payment.$wrap);
				fn.payment.$list = $('#tax_list', fn.payment.$tax_wrap);
				fn.payment.$btn_add = $('#btn_add_tax', fn.payment.$wrap);
				fn.payment.$remove = fn.payment.$wrap.find('.btn-trash');
				fn.payment.current_currency_value = fn.payment.get_current_currency_value();
				 
				if ( $('#paypal_api_username', fn.payment.$wrap).length > 0 ) {
					fn.payment.is_support_spreedly = 1;
                }
                if ( $('#payu_latam_merchantid', fn.payment.$wrap).length > 0 ) {
                    fn.payment.is_support_spreedly = 2;
                }
				
				fn.payment.$remove.bind_confirm({
					name: 'remove-tax',
					before: fn.payment.beforeRemove,
					onSubmit: fn.payment.remove
				});

				fn.payment.$btn_add.on('click', fn.payment.add);

				fn.payment.$wrap.on('change', '.choose-all', fn.payment.chooseAll);
				fn.payment.$wrap.on('update_state', '.choose-all', fn.payment.updateChooseAllState);
				fn.payment.$wrap.on('change', 'input[type="checkbox"].choose', fn.payment.choose);

				fn.payment.$list.on('change keyup focus blur', 'input[type="text"], select', fn.payment.inner_monitor);

				//for spreedly
				fn.payment.show_gateway_credential();
				fn.payment.renderSelectCategory();
				$('#payment_gateway', fn.payment.$wrap).on('change', fn.payment.show_gateway_credential);
				
				$('.togglebox', fn.payment.$wrap).togglebox();

				$('#braintree_isactive_toggle', fn.payment.$wrap).on('changed', function() {
					if ($(this).data('checked')) {
						$("#for_braintree", fn.payment.$wrap).slideDown();
						$('.braintree_box', fn.payment.$wrap).addClass('active');
					} else {
						$("#for_braintree", fn.payment.$wrap).slideUp();
						$('.braintree_box', fn.payment.$wrap).removeClass('active');
					}
				}).trigger('changed');
				
				
				$('#currency', fn.payment.$wrap).on('change', function(){
					$('.span_currency_sign').html(fn.payment.get_current_currency());
				});

				$('#currency', fn.payment.$wrap).trigger('change');  
                $(fn.payment.$wrap).on('focusout', '.tax-value', function(){
                    if ( $(this).closest('.tax-item').children().find('.tax-type').val() == '1' ) {
                        $tax_value = $(this).val();
                        if ( $.inArray(fn.payment.current_currency_value, fn.non_decimal_currency) !== -1 ) {
                            $(this).val(Math.round($tax_value));   
                        } 
                    }      
                });
                $( fn.payment.$wrap).on('change', '.tax-type', function() {
                    if ( $(this).val() == '1' && $.inArray(fn.payment.current_currency_value, fn.non_decimal_currency) !== -1 ) {
                        $tax_value = $(this).closest('.tax-item').children().find('.tax-value').val();
                        $(this).closest('.tax-item').children().find('.tax-value').val(Math.round($tax_value));    
                    }        
                });
                
				fn.payment.re_render();

				fn.payment.is_valid();

			},

			show_gateway_credential: function() {
				fn.payment.payment_gateway = $('#payment_gateway', fn.payment.$wrap).val();
                
                $("#for_braintree", fn.payment.$wrap).slideUp();
                $("#for_paypal", fn.payment.$wrap).slideUp();
                $("#for_payu", fn.payment.$wrap).slideUp();
                $("#for_payu_latam", fn.payment.$wrap).slideUp();
                $('.all_currency_list').hide();
                $('.payu_currency_list').hide();
                $('.payu_latam_currency_list').hide();
                $('.paypal_currency_list').hide();
                $('.braintree_currency_list').hide();
                $('.desc_reqire_paypal_pro').hide();
                
				if ( fn.payment.payment_gateway == 0 ) {
					$('.all_currency_list').show();
				} else if ( fn.payment.payment_gateway == 5 ) {
					$("#for_braintree", fn.payment.$wrap).slideDown();
					$('.braintree_currency_list').show();
				} else if ( fn.payment.payment_gateway == 6 ) {
					$("#for_paypal", fn.payment.$wrap).slideDown();
					$('.paypal_currency_list').show(); 
                    $('.desc_reqire_paypal_pro').show(); 
				} else if ( fn.payment.payment_gateway == 7 ) {
					$("#for_payu", fn.payment.$wrap).slideDown();
					$('.payu_currency_list').show();
				} else if ( fn.payment.payment_gateway == 8 ) {
                    $("#for_payu_latam", fn.payment.$wrap).slideDown()
                    $('.payu_latam_currency_list').show();
                }
				fn.payment.is_valid();	  
			},
			
			//Render payment gateway dropdown with background image
			renderSelectCategory: function () {
				plugin.init_selectbox({
					selector: ".payment_gateway",
					// minimumResultsForSearch: Infinity,
					// data: fn.data.categoryData,
					templateResult: function (data) {
						// if (!data.id || !data.color)
						if (!data.id)
							return data.text;
					   
						var optionHTML = '';
						var class_text = data.text + '_image';
						
						optionHTML += '<span>';
						if ( data.id == 0 ) {
							 optionHTML += '<span class="no_payment_selected" style="line-height:25px; padding-left:10px;">' + data.text + '</span>';
						} else {
							 optionHTML += '<div class="' + class_text + '"></div>';
						}
						optionHTML += '</span>';

						return $(optionHTML);
					},
					templateSelection: function(data) {
						if (!data.id)
							return data.text;
						var optionHTML = '';
						var class_text = data.text + '_image';
						optionHTML += '<div class="category-option">';
						if ( data.id == 0 ) {
							 optionHTML += '<span class="no_payment_selected" style="line-height:25px;">' + data.text + '</span>';
							 $('.payment_gatewayList .select2-selection').css({"height": "28px"});
							 $('.payment_gatewayList .select2-selection__arrow').css({"top": "0px"});
						} else {
							 optionHTML += '<div class="' + class_text + '"></div>';
							 $('.payment_gatewayList .select2-selection').css({"height": "45px"});
							 $('.payment_gatewayList .select2-selection__arrow').css({"top": "10px"});
						}
						optionHTML += '</div>';

						return $(optionHTML);
					}
				});
			},
			
			re_render: function() {
				fn.payment.$list.html('');

				for (var i = 0; i < fn.payment.item_maxNo; i++) {
					if (!fn.payment.taxData[i]) continue;

					var $li = $('#tax-item-model').clone();

					if ($('div.checker', $li).length > 0) {
						$li.find('.choose').insertBefore($li.find('.choose').parents('.checker').eq(0));
						$('div.checker', $li).remove();
					}

					plugin.init_uniform($li);
					plugin.init_selectbox({
						selector: $li.find(".tax-type")
					});


					$('.tax-name', $li).val(fn.payment.taxData[i]['tax_name']);
					$('.tax-type', $li).val(fn.payment.taxData[i]['tax_type']).trigger('change');
					if (fn.payment.taxData[i]['tax_type'] == '1') {
						$('.tax-value', $li).val(fn.payment.taxData[i]['flat_amount']);
					} else {
						$('.tax-value', $li).val(fn.payment.taxData[i]['tax_rate']);
					}


					$li.removeAttr('id').attr('ref-id', fn.payment.taxData[i]['id']);
					$li.tooltip({
						placement: 'top', 
						title: $phrases.build_tip_missing_incorrect_info, 
						animation: false, 
						trigger: 'manual'
					}).clingTooltip();

					$li.appendTo(fn.payment.$list)
				}
			},

			get_current_currency: function() {
				return $("#currency option:selected", fn.payment.$wrap).attr('symbol');
			},
			get_current_currency_value: function() {
				return $("#currency option:selected", fn.payment.$wrap).attr('value');
			},

			get_tax_data: function() {
				fn.payment.taxData = [];
				var tax_cnt = fn.opts.data.tax.length;
				$("li.tax-item", fn.payment.$list).each(function(i, o){
					fn.payment.taxData.push({
						'id': $(o).attr('ref-id'),
						'tax_name': $(o).find('.tax-name').val(),
						'tax_type': $(o).find('.tax-type').val(),
						// 'tax_rate': ($(o).find('.tax-type').val() == '0')?$(o).find('.tax-value').val():"0",
						// 'flat_amount': ($(o).find('.tax-type').val() == '1')?$(o).find('.tax-value').val():"0"
						'tax_rate': ($(o).find('.tax-type').val() == '0') ? $(o).find('.tax-value').val() : (i < tax_cnt ? fn.opts.data.tax[i].tax_rate : '0'),
						'flat_amount': ($(o).find('.tax-type').val() == '1') ? $(o).find('.tax-value').val() : (i < tax_cnt ? fn.opts.data.tax[i].flat_amount : '0')
					});
				});
			},

			add: function() {
				var $li = $('#tax-item-model').clone();
				$li.tooltip({
					placement: 'top', 
					title: $phrases.build_tip_missing_incorrect_info, 
					animation: false, 
					trigger: 'manual'
				}).clingTooltip();
				$li.removeAttr('id').appendTo(fn.payment.$list);

				if($('div.checker', $li).length > 0) {
					$li.find('.choose').insertBefore($li.find('.choose').parents('.checker').eq(0));
					$('div.checker', $li).remove();
				}

				plugin.init_uniform($li);
				plugin.init_selectbox({
					selector: $li.find(".tax-type")
				});

				fn.payment.choose();
				fn.payment.inner_monitor();
			},

			chooseAll: function (e) {

				var $choose = fn.payment.$list.find('input[type="checkbox"].choose');
				$choose.prop('checked', $(this).find('input').is(':checked'));
				$.uniform.update($choose);

				$(this).trigger('update_state');
			},

			updateChooseAllState: function (e) {

				var $choose = fn.payment.$list.find('input[type="checkbox"].choose');
				var count = $choose.length,
					activeCount = $choose.filter(':checked').length,
					$chooseAllCheck = fn.payment.$wrap.find('input[type="checkbox"].check-all');

				if ((count > 0) && (activeCount == count)) {
					$chooseAllCheck.prop('checked', true);
					// $(this).find('.checker').toggleClass('partial', count != activeCount);
				} else {
					$chooseAllCheck.prop('checked', false);
				}


				if (activeCount) {
					fn.payment.$remove.removeAttr('disabled');
				} else {
					fn.payment.$remove.attr('disabled', true);
				}

				$.uniform.update($chooseAllCheck);
			},

			choose: function(e) {
				var $chooseAllCheck = fn.payment.$wrap.find('input[type="checkbox"].check-all');
				$chooseAllCheck.trigger('update_state');
			},

			beforeRemove: function () {

				var $choose = fn.payment.$list.find('li.tax-item input[type="checkbox"]');
					$activeItems = $choose.filter(':checked');

				if (!$activeItems.length) {
					return false;
				}

				$(this.modal).trigger('updateCheckList', [$.map($activeItems, function(itm) {

					var $li = $(itm).parents('li.tax-item').eq(0);
					var lbl = escapeHtml($li.find('.tax-name').val());
					return '<li>'/* + indv + '.'*/ + lbl + '</li>';

				}).join('')]);
				return true;
			},
			remove: function () {
				var $choose = fn.payment.$list.find('li.tax-item input[type="checkbox"]');
					$checked = $choose.filter(':checked');

				// Remove events.
				$.each($checked, function (idx, itm) {
					var $li = $(this).parents('li.tax-item');
					$li.remove();
				});

				fn.payment.choose();
				fn.payment.inner_monitor();
			},

			inner_monitor: function () {
				fn.do_monitor();
			},

			is_valid: function () {
                var valid = true;
                // fn.reservation.highlight_submenu('div_sub_payment', false);

                fn.payment.$wrap.find('.msg.error').remove();
                var braintree_active = $('#braintree_isactive', fn.payment.$wrap).prop('checked'),
                    braintree_id = $('#braintree_id', fn.payment.$wrap).val().trim(),
                    braintree_pubk = $('#braintree_public_key', fn.payment.$wrap).val().trim(),
                    braintree_prik = $('#braintree_private_key', fn.payment.$wrap).val().trim();
                    
                var paypal_api_username = '',
                    paypal_api_password = '',
                    paypal_signature = '',
                    payu_merchantkey = '',
                    payu_salt = '';
                    payu_latam_merchantid = '';
                    payu_latam_accountid = '';
                    payu_latam_apilogin = '';
                    payu_latam_apikey = '';
                    
                if ( fn.payment.is_support_spreedly == 1 ) {
                    paypal_api_username = $('#paypal_api_username', fn.payment.$wrap).val().trim();
                    paypal_api_password = $('#paypal_api_password', fn.payment.$wrap).val().trim();
                    paypal_signature = $('#paypal_signature', fn.payment.$wrap).val().trim();
                    payu_merchantkey = $('#payu_merchantkey', fn.payment.$wrap).val().trim();
                    payu_salt = $('#payu_salt', fn.payment.$wrap).val().trim();
                } else if ( fn.payment.is_support_spreedly == 2 ) {
                    paypal_api_username = $('#paypal_api_username', fn.payment.$wrap).val().trim();
                    paypal_api_password = $('#paypal_api_password', fn.payment.$wrap).val().trim();
                    paypal_signature = $('#paypal_signature', fn.payment.$wrap).val().trim();
                    payu_merchantkey = $('#payu_merchantkey', fn.payment.$wrap).val().trim();
                    payu_salt = $('#payu_salt', fn.payment.$wrap).val().trim();
                    payu_latam_merchantid = $('#payu_latam_merchantid', fn.payment.$wrap).val().trim();
                    payu_latam_accountid = $('#payu_latam_accountid', fn.payment.$wrap).val().trim();
                    payu_latam_apilogin = $('#payu_latam_apilogin', fn.payment.$wrap).val().trim();
                    payu_latam_apikey = $('#payu_latam_apikey', fn.payment.$wrap).val().trim();
                }    
                if (braintree_active && braintree_id == '') {
                    // $('#braintree_id', fn.payment.$wrap).parent().append('<div class="msg right error">' + $phrases.build_label_invalid_value + '</div>');
                    valid = false;
                }
                if (braintree_active && braintree_pubk == '') {
                    // $('#braintree_public_key', fn.payment.$wrap).parent().append('<div class="msg right error">' + $phrases.build_label_invalid_value + '</div>');
                    valid = false;
                }
                if (braintree_active && braintree_prik == '') {
                    // $('#braintree_private_key', fn.payment.$wrap).parent().append('<div class="msg right error">' + $phrases.build_label_invalid_value + '</div>');
                    valid = false;
                }
                
                if ( (fn.payment.payment_gateway == '5') && (braintree_id == '')) {
                     $('#braintree_id', fn.payment.$wrap).parent().append('<div class="msg right error">' + $phrases.build_label_please_input_value + '</div>');
                    valid = false;
                } 
                if ( (fn.payment.payment_gateway == '5') && (braintree_pubk == '')) {
                     $('#braintree_public_key', fn.payment.$wrap).parent().append('<div class="msg right error">' + $phrases.build_label_please_input_value + '</div>');
                    valid = false;
                }
                if ( (fn.payment.payment_gateway == '5') && (braintree_prik == '')) {
                     $('#braintree_private_key', fn.payment.$wrap).parent().append('<div class="msg right error">' + $phrases.build_label_please_input_value + '</div>');
                    valid = false;
                }
                
                if ( (fn.payment.is_support_spreedly == 1) || (fn.payment.is_support_spreedly == 2) ) {
                    if ( (fn.payment.payment_gateway == '6') && (paypal_api_username == '')) {
                         $('#paypal_api_username', fn.payment.$wrap).parent().append('<div class="msg right error">' + $phrases.build_label_please_input_value + '</div>');
                        valid = false;
                    }
                    if ( (fn.payment.payment_gateway == '6') && (paypal_api_password == '')) {
                         $('#paypal_api_password', fn.payment.$wrap).parent().append('<div class="msg right error">' + $phrases.build_label_please_input_value + '</div>');
                        valid = false;
                    }
                    if ( (fn.payment.payment_gateway == '6') && (paypal_signature == '')) {
                         $('#paypal_signature', fn.payment.$wrap).parent().append('<div class="msg right error">' + $phrases.build_label_please_input_value + '</div>');
                        valid = false;
                    }
                    if ( (fn.payment.payment_gateway == '7') && (payu_merchantkey == '')) {
                         $('#payu_merchantkey', fn.payment.$wrap).parent().append('<div class="msg right error">' + $phrases.build_label_please_input_value + '</div>');
                        valid = false;
                    }
                    if ( (fn.payment.payment_gateway == '7') && (payu_salt == '')) {
                         $('#payu_salt', fn.payment.$wrap).parent().append('<div class="msg right error">' + $phrases.build_label_please_input_value + '</div>');
                        valid = false;
                    }
                    if ( (fn.payment.payment_gateway == '8') && (payu_latam_merchantid == '')) {
                         $('#payu_latam_merchantid', fn.payment.$wrap).parent().append('<div class="msg right error">' + $phrases.build_label_please_input_value + '</div>');
                        valid = false;
                    }
                    if ( (fn.payment.payment_gateway == '8') && (payu_latam_accountid == '')) {
                         $('#payu_latam_accountid', fn.payment.$wrap).parent().append('<div class="msg right error">' + $phrases.build_label_please_input_value + '</div>');
                        valid = false;
                    }
                    if ( (fn.payment.payment_gateway == '8') && (payu_latam_apilogin == '')) {
                         $('#payu_latam_apilogin', fn.payment.$wrap).parent().append('<div class="msg right error">' + $phrases.build_label_please_input_value + '</div>');
                        valid = false;
                    }
                    if ( (fn.payment.payment_gateway == '8') && (payu_latam_apikey == '')) {
                         $('#payu_latam_apikey', fn.payment.$wrap).parent().append('<div class="msg right error">' + $phrases.build_label_please_input_value + '</div>');
                        valid = false;
                    }
                }

                // if (!valid) {
                //     fn.reservation.highlight_submenu('div_sub_payment');
                // }
                
                fn.ordering.highlight_submenu('div_sub_payment', !valid);

                return valid;
            },

			check_data_valid: function () {
				var valid = true,
				    $taxs = $('li.tax-item', fn.payment.$list);

				$.each($taxs, function (idx, itm) {
					var tax = fn.payment.taxData[idx];
					if (tax == undefined) return;

					fn.payment.highlight_tax($(itm), false);
					if (fn.payment.check_tax_valid(tax) == false) {
						fn.payment.highlight_tax($(itm));
						valid = false;
					}
				});

				return valid;
			},

			check_tax_valid: function (tax) {
				tax_rate = parseFloat(tax.tax_rate);
				flat_amount = parseFloat(tax.flat_amount);
				if (isNaN(tax_rate)) tax_rate = -1;
				if (isNaN(flat_amount)) flat_amount = -1;
				if (tax.tax_name.trim() == '') return false;
				if (tax.tax_type == '0' && tax_rate < 0) return false;
				if (tax.tax_type == '1' && flat_amount < 0) return false;
				return true;
			},

			highlight_tax: function ($tax, status) {
				if (status == undefined || status != false) status = true;
				if (status) {
					$tax.addClass('missing-info');
					$tax.tooltip('enable');
				} else {
					$tax.removeClass('missing-info');
					$tax.tooltip('disable');
				}
			}
		},

		email: {

			$wrap: null,
			init_done: 0,
			init_done_copy: 0,

			init: function() {

				fn.email.$wrap = $('#div_sub_email', fn.opts.$wrap);

				$.each($('textarea', fn.email.$wrap), function (index, item) {

					// DEV-56
					// Piotr Bozetka
					var html_content_old = $(item).val();
					var html_content_new = plugin.fixcode.clean(html_content_old);
					if(html_content_old != html_content_new)
					{
						$(item).val(html_content_new);
						fn.opts.$wrap.trigger('forceSave');
					}

					var $itemCopy = $(item).clone();
					$itemCopy.appendTo($(item).parent());
					plugin.init_redactor({
						selector: $(item),
						autoresize: false,
						maxHeight: 500,
						minHeight: 150,
						changeCallback: fn.email.wysiwyg_changed,
						initCallback: function () {
							fn.email.init_done ++;
						}
					});
					plugin.init_redactor({
						selector: $itemCopy,
						autoresize: false,
						maxHeight: 500,
						minHeight: 150,
						initCallback: function () {
							$itemCopy.parent('.redactor-box').hide();
							fn.email.init_done_copy ++;
						},
					});
				});

				fn.email.is_valid();

			},

			wysiwyg_changed: function (e) {
				// TO DO
				fn.do_monitor();
			},

			getchanged: function (obj, obj_copy) {
				if (fn.email.init_done < 3 || fn.email.init_done_copy < 3) return false;

				var redactorObj = $(obj).redactor('core.getObject'),
				    copyObj = $(obj_copy).redactor('core.getObject'),
				    redactorCode = redactorObj.code.get(),
				    copyCode = copyObj.code.get();
				return copyCode != redactorCode;
			},
			
			wysiwyg_getchanged: function () {
				var $messages = $('textarea.message', fn.email.$wrap),
				    $admin_msgs = $('textarea.admin-message', fn.email.$wrap),
				    $ordered_items = $('textarea.ordered-items-tpl', fn.email.$wrap),
				    changed = false;
				changed = changed || fn.email.getchanged($messages.get(0), $messages.get(1));
				changed = changed || fn.email.getchanged($admin_msgs.get(0), $admin_msgs.get(1));
				changed = changed || fn.email.getchanged($ordered_items.get(0), $ordered_items.get(1));
				return changed;
			},

			is_valid: function () {
				// if (!fn.is_init_done) return true;
				
				var valid = true;
				// check if email is valid on emails submenu
				// fn.ordering.highlight_submenu('div_sub_email', false);
				var $admin_email = $('#admin_email', fn.opts.$wrap);
				$admin_email.siblings('.msg.error').remove();
				if ($admin_email.val().trim() != '' && fn.loc_modal.invalid_email($admin_email.val().trim())) {
					$admin_email.parent().append('<div class="msg right error">' + $phrases.build_label_email_invalid + '</div>');
					// fn.ordering.highlight_submenu('div_sub_email');
					valid = false;
				}

				fn.ordering.highlight_submenu('div_sub_email', !valid);

				return valid;
			}
		},


		// CV-2948
		// Piotr Bozetka
		// Redactor 2 Editor
		email2: {

			$wrap: null,
			init_done: false,
			init_done_copy: false,

			init: function() {

				fn.email2.$wrap = $('#div_sub_email', fn.opts.$wrap);

				$.each($('textarea', fn.email2.$wrap), function (index, item) {

					// DEV-56
					// Piotr Bozetka
					var html_content_old = $(item).val();
					var html_content_new = plugin.fixcode.clean(html_content_old);
					if(html_content_old != html_content_new)
					{
						$(item).val(html_content_new);
						fn.opts.$wrap.trigger('forceSave');
					}

					var $itemCopy = $(item).clone();
					$itemCopy.appendTo($(item).parent());
					plugin.init_redactor2({
						selector: $(item),
						autoresize: false,
						maxHeight: 500,
						minHeight: 150,
						callbacks:
						{
							init: function () {
								fn.email2.init_done = true;
							},
							change: fn.email2.wysiwyg_changed
						}
					});
					plugin.init_redactor2({
						selector: $itemCopy,
						autoresize: false,
						maxHeight: 500,
						minHeight: 150,
						callbacks:
						{
							init: function () {
								$itemCopy.parent('.redactor-box').hide();
								fn.email2.init_done_copy = true;
							},
						}
					});
				});

				fn.email2.is_valid();

			},

			wysiwyg_changed: function (e) {
				// TO DO
				fn.do_monitor();
			},

			getchanged: function (obj, obj_copy) {
				if (fn.email2.init_done == false || fn.email2.init_done_copy == false) return false;

				var redactorObj = $(obj).redactor('core.object'),
				    copyObj = $(obj_copy).redactor('core.object'),
				    redactorCode = redactorObj.code.get(),
				    copyCode = copyObj.code.get();
				return copyCode != redactorCode;
			},

			wysiwyg_getchanged: function () {
				var $messages = $('textarea.message', fn.email2.$wrap),
				    $admin_msgs = $('textarea.admin-message', fn.email2.$wrap),
				    $ordered_items = $('textarea.ordered-items-tpl', fn.email2.$wrap),
				    changed = false;
				changed = changed || fn.email2.getchanged($messages.get(0), $messages.get(1));
				changed = changed || fn.email2.getchanged($admin_msgs.get(0), $admin_msgs.get(1));
				changed = changed || fn.email2.getchanged($ordered_items.get(0), $ordered_items.get(1));
				return changed;
			},

			is_valid: function () {
				// if (!fn.is_init_done) return true;

				var valid = true;
				// check if email is valid on emails submenu
				// fn.ordering.highlight_submenu('div_sub_email', false);
				var $admin_email = $('#admin_email', fn.opts.$wrap);
				$admin_email.siblings('.msg.error').remove();
				if ($admin_email.val().trim() != '' && fn.loc_modal.invalid_email($admin_email.val().trim())) {
					$admin_email.parent().append('<div class="msg right error">' + $phrases.build_label_email_invalid + '</div>');
					// fn.ordering.highlight_submenu('div_sub_email');
					valid = false;
				}

				fn.ordering.highlight_submenu('div_sub_email', !valid);

				return valid;
			}
		},

		addon: {

			$wrap: null,
			$google_auth_window: null,
			$list: null,

			$btn_add: null,
			$remove: null,


			gpData: null,
			item_maxNo: 0,
			origin_from_get: false,
			printers: null,

			init: function() {

				fn.addon.$wrap = $('#div_sub_addon', fn.opts.$wrap);
				fn.addon.$list = $('#gp_list', fn.addon.$wrap);

				fn.addon.$btn_add = $('#btn_add_printer', fn.addon.$wrap);
				fn.addon.$btn_add_fake = $('#btn_add_printer_fake', fn.addon.$wrap);
				fn.addon.$remove = fn.addon.$wrap.find('.btn-trash');

				fn.addon.$remove.bind_confirm({
					name: 'remove-printer',
					before: fn.addon.beforeRemove,
					onSubmit: fn.addon.remove
				});

				fn.addon.$btn_add_fake.bind_modal({
					modalId: 'edit_ordering_printer_modal',
					onHide: function () {},
					onShow: function () {
						plugin.init_uniform($(this.modal).find('.choose-all'));
					},
					onShown: function () {}
				});

				fn.addon.$list.sortable({
					items: '.gp',
					revert: true,
					opacity: 0.5,
					helper: 'clone',
					handle: '.handle-drag',
					axis: 'y',
					start: function(e, ui) {
						$(ui.item).parent().sortable("refreshPositions");
					},
					stop: function() {
						fn.addon.re_fresh();
					}
				});


				fn.addon.$btn_add.on('click', fn.addon.add_printer);
				fn.addon.$list.on('click', '>li .btn-edit', fn.addon.edit_printer);

				fn.addon.$wrap.on('click', '#btn_google_printer_connected', fn.addon.gp_connected);
				fn.addon.$wrap.on('click', '#btn_google_printer_disconnected', fn.addon.gp_disconnected);

				fn.addon.$wrap.on('click', '#btn_connect_printer', fn.addon.gp_connect_byclick);
				fn.addon.$wrap.on('click', '#btn_disconnect_printer', fn.addon.gp_disconnect);

				fn.addon.$wrap.on('change', '.choose-all', fn.addon.chooseAll);
				fn.addon.$wrap.on('update_state', '.choose-all', fn.addon.updateChooseAllState);
				fn.addon.$wrap.on('change', 'input[type="checkbox"].choose', fn.addon.choose);

				fn.addon.toggle_gp_buttons(fn.opts.data.gp_on);

				fn.addon.re_render();

				fn.addon.is_valid();
			},

			re_render: function() {

				fn.addon.$list.html('');

				for (var i=0; i<fn.addon.item_maxNo; i++) {
					if (!fn.addon.gpData[i]) continue;
					fn.addon.render(fn.addon.gpData[i], false);
				}
				fn.addon.re_fresh ();
			},

			render: function (gp, should_refresh) {

				var $li = fn.addon.render_atom(gp);
				$li.appendTo(fn.addon.$list);
				plugin.init_uniform($li);

				if (should_refresh) fn.addon.re_fresh ();
			},

			render_atom: function (gp) {

				var $li = $('<li class="gp" data-id="' + gp.ref_id + '" id="gp_' + gp.ref_id + '">');

				$li.append('<input data-val-skip="true" class="choose" type="checkbox" />');
				$li.append('<i class="handle-drag fa fa-arrows"></i>');
				$li.append('<div class="title">' + escapeHtml(gp.title) + '</div>');

				$li.append('<button class="btn-edit btn btn-dashboard btn-white"><i class="iconba icon-edit-single"></i></button>');

				return $li
			},

			re_fresh: function() {

				fn.addon.$wrap.find('span.count').html($phrases["build_content_printer_count"].replace('{count}', fn.addon.$list.find('li.gp').length));
				var total_cn = fn.addon.$list.find('li.gp').length;

				$.each(fn.addon.$list.find('li.gp input[type="checkbox"]'), function (idx, itm) {
					// Update seq and section
					var $li = $(itm).parents('li.gp').eq(0);
					var	id = $li.attr('data-id');
					fn.addon.gpData[id]['seq'] = total_cn - idx;
				});

				fn.do_monitor();
			},

			toggle_gp_buttons: function(gp_on) {
				if(gp_on == '1') {
					$('#btn_connect_printer', fn.addon.$wrap).hide();
					$('#btn_disconnect_printer', fn.addon.$wrap).show();
				} else {
					$('#btn_disconnect_printer', fn.addon.$wrap).hide();
					$('#btn_connect_printer', fn.addon.$wrap).show();
				}
			},

			gp_connect: function(urlv){

				if (fn.addon.$google_auth_window != null) fn.addon.$google_auth_window.close();

				var w = 800;
				var h = 600;
				var left = (screen.width/2)-(w/2);
					var top = (screen.height/2)-(h/2);
					var opt_str = 'toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=no, resizable=no, copyhistory=no, width='+w+', height='+h+', top='+top+', left='+left;
				fn.addon.$google_auth_window = window.open(urlv, 'GOOGLE-AUTH', opt_str);
			},

			gp_connect_byclick: function(){
				fn.addon.gp_connect($(this).attr('ref'));
			},

			gp_disconnect: function(){

				fn.opts.$wrap.started(0.5);
				ajax.post('tab.orderingView.google_auth_off', {'id':$('#tab_id_4flyupagent').val()}, function (json) {


					fn.opts.$wrap.completed();
					notify.success(json.msg);
					fn.addon.toggle_gp_buttons('0');


				});

			},

			gp_connected: function(){
				if (fn.addon.$google_auth_window != null) fn.addon.$google_auth_window.close();
				fn.addon.toggle_gp_buttons('1');
				if (fn.addon.origin_from_get) {
					fn.addon.origin_from_get = false;
					if (fn.gp_modal.currentEditId === false) {
						fn.addon.$btn_add.trigger('click');
					} else {
						$('#gp_' + fn.gp_modal.currentEditId + ' .btn-edit', fn.addon.$list).trigger('click');
					}

				}
			},

			gp_disconnected: function(){
				if (fn.addon.$google_auth_window != null) fn.addon.$google_auth_window.close();
				fn.addon.toggle_gp_buttons('0');
			},

			get_printers: function() {

				fn.opts.$wrap.overlay({opacity: .5, 'z-index': 100});

				ajax.post('util.googlePrinter.google_get_printers', {'tab_id':$('#tab_id_4flyupagent').val()}, function (json) {

					fn.opts.$wrap.completed();

					if(json.success) {
						// Process Printer List for printer_modal
						fn.addon.printers = jQuery.extend(true, [], json.data.printers);
						fn.gp_modal.re_render_printers(fn.addon.printers);
						if (fn.gp_modal.currentEditId === false) {
							fn.gp_modal.add();
						} else {
							fn.gp_modal.edit();
						}
					} else {
						// means, google auth has an issue here, so need to re-auth
						if (json.code == '1') {

							notify.error(json.msg, 'center', 5000);

						} else {

							notify.error(json.msg, 'center', 5000);
							return;

							fn.addon.toggle_gp_buttons('0');
							fn.addon.origin_from_get = true;
							fn.addon.gp_connect($('#btn_connect_printer').attr('ref'));

						}
					}
				});

			},

			is_printers_empty: function() {
				if (fn.addon.printers == null) return true;
				if (fn.addon.printers instanceof Array) {
					if (fn.addon.printers.length > 0) {
						fn.gp_modal.re_render_printers();
						return false;
					}
				}
				return true;
			},

			add_printer: function(e) {
				fn.gp_modal.currentEditId = false;
				if (fn.addon.is_printers_empty()) {
					fn.addon.get_printers();
				} else {
					fn.gp_modal.add();
				}
			},

			edit_printer: function(e) {

				var idv = $(this).parent().attr('data-id');
				fn.gp_modal.currentEditId = idv;
				if (fn.addon.is_printers_empty()) {
					fn.addon.get_printers();
				} else {
					fn.gp_modal.edit();
				}
			},

			chooseAll: function (e) {

				var $choose = fn.addon.$list.find('input[type="checkbox"].choose');
				$choose.prop('checked', $(this).find('input').is(':checked'));
				$.uniform.update($choose);

				$(this).trigger('update_state');
			},

			updateChooseAllState: function (e) {

				var $choose = fn.addon.$list.find('input[type="checkbox"].choose');
				var count = $choose.length,
					activeCount = $choose.filter(':checked').length,
					$chooseAllCheck = fn.addon.$wrap.find('input[type="checkbox"].check-all');

				if ((count > 0) && (activeCount == count)) {
					$chooseAllCheck.prop('checked', true);
					// $(this).find('.checker').toggleClass('partial', count != activeCount);
				} else {
					$chooseAllCheck.prop('checked', false);
				}


				if (activeCount) {
					fn.addon.$remove.removeAttr('disabled');
				} else {
					fn.addon.$remove.attr('disabled', true);
				}

				$.uniform.update($chooseAllCheck);
			},

			choose: function(e) {
				var $chooseAllCheck = fn.addon.$wrap.find('input[type="checkbox"].check-all');
				$chooseAllCheck.trigger('update_state');
			},


			beforeRemove: function () {

				var $choose = fn.addon.$list.find('li.gp input[type="checkbox"]');
					$activeItems = $choose.filter(':checked');

				if (!$activeItems.length) {
					return false;
				}

				$(this.modal).trigger('updateCheckList', [$.map($activeItems, function(itm) {

					var $li = $(itm).parents('li.gp').eq(0);
					var idv = $li.attr('data-id');
					var lbl = escapeHtml(fn.addon.gpData[idv]['title']);

					return '<li>'/* + indv + '.'*/ + lbl + '</li>';

				}).join('')]);
				return true;
			},
			remove: function () {
				var $choose = fn.addon.$list.find('li.gp input[type="checkbox"]');
					$checked = $choose.filter(':checked');

				// Remove events.
				$.each($checked, function (idx, itm) {
					var $li = $(this).parents('li.gp');
					var ind = $li.attr("data-id");

					$li.remove();
					delete fn.addon.gpData[ind];
				});

				fn.addon.choose();
				fn.addon.re_fresh();
			},

			is_valid: function () {
				var valid = true;
				
				fn.ordering.highlight_submenu('div_sub_addon', false);
				
				return valid;
			}
		},

		gp_modal: {

			$modal: null,
			$list: null,

			$title: null,
			$save: null,
			$cancel: null,

			currentEditId: false,

			init: function() {

				fn.gp_modal.$modal = $('#edit_ordering_printer_modal');
				fn.gp_modal.$list = $('#printer_list', fn.gp_modal.$modal);

				fn.gp_modal.$title = fn.gp_modal.$modal.find('.modal-header .modal-title');
				fn.gp_modal.$save = fn.gp_modal.$modal.find('.modal-footer .btn-save');
				fn.gp_modal.$cancel = fn.gp_modal.$modal.find('.modal-footer .btn-no');

				fn.gp_modal.$save.on('click', fn.gp_modal.save);

				fn.gp_modal.$modal.on('change', '.printer-choose-all', fn.gp_modal.chooseAll);
				fn.gp_modal.$modal.on('update_state', '.printer-choose-all', fn.gp_modal.updateChooseAllState);
				fn.gp_modal.$modal.on('change', 'input[type="checkbox"].choose', fn.gp_modal.choose);

				fn.gp_modal.$modal.on('change', 'select', fn.gp_modal.inner_monitor);
				fn.gp_modal.$modal.on('keyup', 'input[type=text]', fn.gp_modal.inner_monitor);

				fn.gp_modal.re_render_locs();
			},

			re_render_locs: function () {

				$('#imported_loc', fn.gp_modal.$modal).html('');

				$('#imported_loc', fn.gp_modal.$modal).append('<option value="">' + $phrases["build_label_select_location"] + '</option>');
				var locs = jQuery.extend(true, [], fn.loc.locData);
				for (var keyv = 0; keyv < locs.length; keyv++) {
					var label = fn.loc.get_display_address(locs[keyv]);
					$('#imported_loc', fn.gp_modal.$modal).append('<option value="' + keyv + '">' + escapeHtml(label) + '</option>');
				}

				plugin.init_selectbox({
					selector: $('#imported_loc', fn.gp_modal.$modal)
				});

			},

			re_render_printers: function (printers) {

				fn.gp_modal.$list.html('');

				for (var i=0; i<fn.addon.printers.length; i++) {

					var $li = $('<li class="printer" data-id="' + fn.addon.printers[i].id + '" id="printer_' + fn.addon.printers[i].id + '">');

					$li.append('<div class="title">' + escapeHtml(fn.addon.printers[i].name) + '</div>');
					$li.append('<input data-val-skip="true" class="choose" type="checkbox" />');

					$li.appendTo(fn.gp_modal.$list);

					plugin.init_uniform($li);
				}

			},

			switchEditType: function (isAdd) {
				var dataLabel = isAdd ? 'data-add-label' : 'data-edit-label';
				fn.gp_modal.$title.html(fn.gp_modal.$title.attr(dataLabel));
				fn.gp_modal.$save.html(fn.gp_modal.$save.attr(dataLabel));
			},

			inner_monitor: function () {
				var $choose = fn.gp_modal.$list.find('li.printer input[type="checkbox"]');
					$activeItems = $choose.filter(':checked');

				var is_valid = false;
				if (($('#imported_loc', fn.gp_modal.$modal).val() == '') || ($activeItems.length < 1) || ($('#printer_title', fn.gp_modal.$modal).val() == '')) {
					is_valid = false;
				} else {
					is_valid = true;
				}

				// Detect changes
				var is_same = false;
				var gpd = {};
				if (fn.gp_modal.currentEditId !== false) gpd = fn.addon.gpData[fn.gp_modal.currentEditId];
				var new_gpd = fn.gp_modal.inputData();
				var is_same = deepCompare(new_gpd, gpd);

				if (is_valid && !is_same) {
					fn.gp_modal.$save.removeAttr('disabled');
				} else {
					fn.gp_modal.$save.attr('disabled', true);
				}
			},

			chooseAll: function (e) {

				var $choose = fn.gp_modal.$modal.find('input[type="checkbox"].choose');
				$choose.prop('checked', $(this).find('input').is(':checked'));
				$.uniform.update($choose);

				$(this).trigger('update_state');
			},

			updateChooseAllState: function (e) {

				var $choose = fn.gp_modal.$modal.find('input[type="checkbox"].choose');
				var count = $choose.length,
					activeCount = $choose.filter(':checked').length,
					$chooseAllCheck = fn.gp_modal.$modal.find('input[type="checkbox"].check-all');

				if ((count > 0) && (activeCount == count)) {
					$chooseAllCheck.prop('checked', true);
					// $(this).find('.checker').toggleClass('partial', count != activeCount);
				} else {
					$chooseAllCheck.prop('checked', false);
				}

				$.uniform.update($chooseAllCheck);
				fn.gp_modal.inner_monitor();
			},

			choose: function(e) {
				var $chooseAllCheck = fn.gp_modal.$modal.find('input[type="checkbox"].check-all');
				$chooseAllCheck.trigger('update_state');
			},

			add: function() {

				fn.gp_modal.re_render_locs();
				fn.gp_modal.switchEditType(true);

				$('#printer_title', fn.gp_modal.$modal).val('');
				$('#imported_loc', fn.gp_modal.$modal).val('').trigger('change');
				$('.choose', fn.gp_modal.$modal).each(function(i, o){
					$(o).prop('checked', false);
					$.uniform.update($(o));
				});

				fn.gp_modal.$modal.modal('show');
				fn.gp_modal.updateChooseAllState();
				fn.gp_modal.inner_monitor();

			},

			edit: function() {

				fn.gp_modal.re_render_locs();
				fn.gp_modal.switchEditType(false);

				var data = fn.addon.gpData[fn.gp_modal.currentEditId];

				$('#printer_title', fn.gp_modal.$modal).val(data['title']);
				$('#imported_loc', fn.gp_modal.$modal).val(data['location_id']).trigger('change');

				$('.choose', fn.gp_modal.$modal).each(function(i, o){
					$(o).prop('checked', false);
					$.uniform.update($(o));
				});

				try {

					for (var i=0; i<data.google_printers.length; i++) {
						$('#printer_' + data.google_printers[i]['id']).find('.choose').prop('checked', true);
						$.uniform.update($('#printer_' + data.google_printers[i]['id']).find('.choose'));
					}

				} catch(e) {}

				fn.gp_modal.$modal.modal('show');
				fn.gp_modal.updateChooseAllState();
				fn.gp_modal.inner_monitor();
			},

			inputData: function() {

				var data = {};
				if (fn.gp_modal.currentEditId !== false) data = jQuery.extend(true, {}, fn.addon.gpData[fn.gp_modal.currentEditId]);

				data['title'] = $('#printer_title', fn.gp_modal.$modal).val();
				data['location_id'] = $('#imported_loc', fn.gp_modal.$modal).val();
				data['google_printers'] = [];

				fn.gp_modal.$list.find('input[type="checkbox"].choose').filter(':checked').each(function(i, o){
					var $pli = $(o).parents('li.printer');
					data['google_printers'].push({
						'id': fn.addon.printers[$pli.index()]['id'],
						'proxy': fn.addon.printers[$pli.index()]['proxy']
					});
				});

				return data;

			},

			save: function() {

				var data = fn.gp_modal.inputData();

				if (fn.gp_modal.currentEditId === false) {
					data['id'] = '0';
					data['ref_id'] = fn.addon.item_maxNo;
					fn.addon.gpData[fn.addon.item_maxNo] = data;
					fn.addon.item_maxNo = fn.addon.item_maxNo + 1;
					fn.addon.render(data, true);
				} else {
					fn.addon.gpData[fn.gp_modal.currentEditId] = data;
					$('#gp_' + fn.gp_modal.currentEditId + ' .title').html(escapeHtml(data.title));
				}

				fn.gp_modal.$modal.modal('hide');

				fn.addon.re_fresh();
				fn.addon.updateChooseAllState();
			}
		},

		menu: {

			$wrap: null,
			$menu_wrap: null,
			$list: null,

			$remove: null,

			itemData: null,
			item_maxNo: null,

			init: function () {

				fn.menu.$wrap = $('#div_sub_menu', fn.opts.$wrap);
				fn.menu.$menu_wrap = $('.items', fn.menu.$wrap);
				fn.menu.$list = $('#cat_list', fn.menu.$menu_wrap);
				fn.menu.$remove = $('.btn-trash', fn.menu.$menu_wrap);

				$('.view-opt', fn.menu.$wrap).on('click', function(e){
					e.preventDefault();
					$('#view_mode', fn.menu.$wrap).val($(this).attr('ref'));
					fn.menu.reflect_viewmode();
					fn.do_monitor();
				});

				/*
				$('.btn_add_category', fn.menu.$wrap).bind_modal({
					modalId: 'edit_ordering_cat_modal'
				}).on("click", fn.menu.add_category);
				*/

				$('#btn_add_item_fake', fn.menu.$wrap).bind_modal({
					modalId: 'edit_ordering_item_modal',

					onCancel: function () {

						//Checking assigned image is deleted or not, if yes, should set no-image
						if ($(".img-picker-ordering-item", fn.item_modal.$modal).data("is_deleted")) {

							var item = fn.menu.itemData[fn.item_modal.currentEditCatId]['items'][fn.item_modal.currentEditId];
							if (typeof item == "undefined") return;

							item.thumb_id = "";
							item.thumb_filename = "";

							$(".img-picker-ordering-item", fn.item_modal.$modal).data("is_deleted", false);
						}

						fn.opts.$wrap.trigger('monitor');
					},

					onSave: function() {
						$(".img-picker-ordering-item", fn.item_modal.$modal).data("is_deleted", false);
						fn.opts.$wrap.trigger('monitor');
					}
				});

				$('#btn_add_item_fake', fn.menu.$wrap).bind_modal({
					modalId: 'edit_ordering_cat_modal',

					onCancel: function () {

						//Checking assigned image is deleted or not, if yes, should set no-image
						if ($(".img-picker-ordering-cat", fn.cat_modal.$modal).data("is_deleted")) {
							
							var cat = fn.menu.itemData[fn.cat_modal.currentEditId];
							if (typeof cat == "undefined") return;

							cat.thumb_id = "";
							cat.thumb_filename = "";
							cat.thumb_link = $('#cat_img', fn.cat_modal.$modal).data("url");
							$(".img-picker-ordering-cat", fn.cat_modal.$modal).data("is_deleted", false);
						}
						fn.opts.$wrap.trigger('monitor');
					},

					onSave: function() {
						$(".img-picker-ordering-cat", fn.cat_modal.$modal).data("is_deleted", false);
						fn.opts.$wrap.trigger('monitor');
					}
				});

				$('.btn_add_item', fn.menu.$wrap).on("click", fn.menu.add_item);
				$('.btn_add_category', fn.menu.$wrap).on("click", fn.menu.add_category);
				fn.menu.$list.on('click', '.section-editor', fn.menu.edit_category);
				fn.menu.$list.on('click', '.btn-edit', fn.menu.edit_item);
				fn.menu.$list.on('click', 'li.cat', fn.menu.cat_activate);


				fn.menu.reflect_viewmode();

				fn.menu.re_render();

				fn.menu.is_valid();

				fn.menu.$list.sortable({
					items: '.cat',
					revert: false,
					opacity: 0.5,
					helper: 'clone',
					/*
					helper: function(e, obj){
						var $helper = $(obj).clone();
						$('a.full-toggle', $helper).addClass('collapsed');
						$('.panel > div', $helper).eq(1).remove();
						// $('.panel > div', $helper).eq(1).removeClass('in');
						return $helper;
					},
					*/
					handle: '.section-drag',
					axis: 'y',
					// containment: '#cat_list_wrapper',
					start: function(e, ui) {
						fn.menu.$list.sortable("refreshPositions");
					},
					stop: fn.menu.sort_cat
				});

				fn.menu.init_handlers ();

				fn.menu.$remove.bind_confirm({
					name: 'remove-menu',
					before: fn.menu.beforeRemove,
					onSubmit: fn.menu.remove
				});

				// This is fake event handler to manage 1-cat-open logic
				fn.menu.$list.on('click', 'a.full-toggle', fn.menu.click_full_toggle);
			},

			init_handlers: function () {

				fn.menu.$list.off('change', '.choose-all');
				fn.menu.$list.off('update_state', '.choose-all');
				fn.menu.$list.off('change', 'input[type="checkbox"].choose');

				fn.menu.$list.on('change', '.choose-all', fn.menu.chooseAll);
				fn.menu.$list.on('update_state', '.choose-all', fn.menu.updateChooseAllState);
				fn.menu.$list.on('change', 'input[type="checkbox"].choose', fn.menu.choose);
			},

			click_full_toggle: function () {
				if ($(this).hasClass('collapsed')) {
					fn.menu.$list.find('a.full-toggle').not('.collapsed').each(function(i, o){
						$(o).trigger('click');
					});
				}
				
				// setTimeout(function(){
				// 	var $li = fn.menu.$list.find('li.cat.active').eq(0);
				// 	if ( $li.length ) {
				// 		if ($li.offset().top < 170) {
				// 			var diff = 170 - $li.offset().top;
				// 			$('.content').animate({'scrollTop': $('.content').scrollTop() - diff}); // due to curtain at top, it gets overlapped.  
				// 		}
				// 	}
				// }, 500);
			},

			re_render: function() {
				for (var k = 0; k < fn.menu.itemData.length; k++) {
					var cat = fn.menu.itemData[k];
					fn.menu.render_cat(cat);
					/*for(ik in cat['items']) {
						fn.menu.render_item(cat['items'][ik], false);
					}*/
				}

				try {
					// We should enable this to open the first menu and expaned it by default. Added by Daniel Lu
					// If you want this commented out, please leave your description why do you need.
					fn.menu.$list.find('li.cat').eq(0).find('a.full-toggle').trigger('click');

					// fn.menu.click_full_toggle.call(fn.menu.$list.find('li.cat').eq(0).find('a.full-toggle'));
				} catch(e) {}

				fn.menu.re_fresh();
			},

			render_category_items: function (category_id) {
				if (fn.menu.itemData[category_id] == undefined) return;
				for (var ik = 0; ik < fn.menu.itemData[category_id]['items'].length; ik++) {
					fn.menu.render_item(fn.menu.itemData[category_id]['items'][ik], false);
				}
			},

			reflect_viewmode: function() {
				$('.view-opt', fn.menu.$wrap).removeClass('active');
				if ($('#view_mode', fn.menu.$wrap).val() == '1') {
					$('a.view-opt[ref=1]', fn.menu.$wrap).addClass('active');
				} else {
					$('a.view-opt[ref=0]', fn.menu.$wrap).addClass('active');
				}
			},

			isActiveChanged4Cat: function(e) {
				var checked = $(this).data('checked'),
					$li = $(this).parents('li.cat').eq(0),
					refv = $li.attr('data-id');

				if (checked) {
					fn.menu.itemData[refv].is_active = '1';
				} else {
					fn.menu.itemData[refv].is_active = '0';
				}

				fn.do_monitor();
			},

			isActiveChanged4Item: function(e) {
				var checked = $(this).data('checked'),
					$li_cat = $(this).parents('li.cat').eq(0),
					$li_item = $(this).parents('li.item').eq(0),
					ref_cat = $li_cat.attr('data-id'),
					ref_item = $li_item.attr('data-id');

				// if (checked && fn.menu.itemData[ref_cat]['items'][ref_item].is_available == '0') {
				if (checked) {
					if ($(this).data('prev_active')) {
						fn.menu.itemData[ref_cat]['items'][ref_item].is_available = $(this).data('prev_active');
					} else {
						// this should not be happening, but who knows.
						fn.menu.itemData[ref_cat]['items'][ref_item].is_available = '2';
					}
				} else {
					fn.menu.itemData[ref_cat]['items'][ref_item].is_available = '0';
				}

				fn.do_monitor();
			},

			categorySync: function (category_id) {
				var tab_id = fn.opts.$wrap.attr('data-tab-id');
				var cat_id = fn.menu.itemData[category_id] == undefined ? 0 : fn.menu.itemData[category_id].id;
				if (cat_id == 0) return;
				var service_id = $('#service_id', fn.service.$wrap).val();

				if (fn.is_init_done) {
					fn.opts.$content.completed();
					fn.opts.$content.overlay({'opacity': .5, 'background-color': '#f8f8f8', 'z-index': 100});
				}
				ajax.post('tab.orderingView.load_items', {id: tab_id, menu_id: cat_id, main_id: service_id}, function(json) {
					// console.log(json);
					if (json.length) {
						/* create location index array */
						var loc_index = {};
						for (i = 0; i < fn.loc.item_maxNo; i++) {
							if (fn.loc.locData[i] == undefined) continue;
							loc_index[fn.loc.locData[i].id] = i;
						}
						/* convert item locations array to loc index array */
						for (k in json) {
							var item = json[k];
							item.menu_id = category_id;
							var locs = [];
							for (lk in item['locations']) {
								if (loc_index[item['locations'][lk]] != undefined) locs.push(loc_index[item['locations'][lk]]);
							}
							locs.sort(function(a, b){return a - b});
							item.locations = locs;
						}
						fn.opts.data.menuData[category_id].items = json;
						fn.menu.itemData[category_id].items = jQuery.extend(true, [], json);
						fn.menu.render_category_items(category_id);
					}
					if (fn.is_init_done) fn.opts.$content.completed();
					fn.opts.$wrap.trigger('init_sync_done'); // for initial sync on ordering
					fn.opts.$wrap.trigger('monitor');
				});
			},
			
			cat_activate: function() {
				$(this).addClass('active').siblings().removeClass('active');
				/* ajax call for gettimg items - Douglas */
				var synced = $(this).attr('data-synced'),
				    id = $(this).attr('data-id');
				if (synced == undefined || synced == '0') {
					fn.menu.categorySync(id);
					$(this).attr('data-synced', '1');
				}
			},

			add_category: function() {
				fn.cat_modal.currentEditId = false;
				fn.cat_modal.edit();
			},

			edit_category: function() {
				fn.cat_modal.currentEditId = $(this).parents('li.cat').eq(0).attr('data-id');
				fn.cat_modal.edit();
			},

			add_item: function() {
				fn.item_modal.currentEditId = false;
				fn.item_modal.edit();
			},

			edit_item: function() {
				fn.item_modal.currentEditCatId = $(this).parents('li.cat').eq(0).attr('data-id');
				fn.item_modal.currentEditId = $(this).parents('li.item').eq(0).attr('data-id');
				fn.item_modal.edit();
			},

			render_cat: function (cat) {

				var $li = $('<li class="cat" id="cat_' + cat.ref_id + '" data-id="' + cat.ref_id + '">');

				var innerEleme = '<div class="panel panel-default">' +
								  '<div class="panel-heading" role="tab" id="section_header_' + cat.ref_id + '" style="text-transform: none;">' +
								  	'<div class="choose-all"><input type="checkbox" class="check-all"></div>' +
								  	'<i class="section-drag fa fa-arrows"></i>' +
								  	'<div class="is-active-toggler togglebox ' + ((cat.is_active == "1")?"checked":"") + '"></div>' +
								  	'<span class="section-title">' + escapeHtml(cat.label) + '</span><span class="section-count">' + cat.item_maxNo + ' ' + $phrases.build_count_suffix_items + '</span>' +
									'<a data-toggle="collapse" href="#section_body_' + cat.ref_id + '" aria-expanded="true" aria-controls="section_' + cat.ref_id + '" class="full-toggle collapsed"><i class="fa ic-toggle"></i></a>' +
									'<i class="iconba icon-edit-single section-editor" style="float: right;"></i>' +
								  '</div>' +

								  '<div id="section_body_' + cat.ref_id + '" class="panel-collapse collapse" role="tabpanel" aria-labelledby="section_header_' + cat.ref_id + '">' +
									'<div class="panel-body">' +
									  '<div class="row col-lg-12">' +

											'<ul class="item_wrapper list" id="item_wrapper_' + cat.ref_id + '" data-id="' + cat.ref_id + '">' +
					  						'</ul>' +

									  '</div>' +
									'</div>' +
								  '</div>' +
								'</div>' +
							'</li>';

				$li.append(innerEleme);
				$li.find('.panel-heading').tooltip({
					placement: 'top', 
					title: $phrases.build_tip_missing_incorrect_info, 
					animation: false, 
					trigger: 'manual'
				}).clingTooltip();

				$li.appendTo(fn.menu.$list);
				
				plugin.init_uniform($li);
				
				$li.find('.is-active-toggler').togglebox().on('changed', fn.menu.isActiveChanged4Cat);

				fn.menu.$list.find('#item_wrapper_' + cat.ref_id).sortable({
					items: '.item',
					revert: false,
					opacity: 0.5,
					helper: 'clone',
					handle: '.handle-drag',
					axis: 'y',
					// containment: '#cat_list_wrapper',
					start: function(e, ui) {
						$(ui.item).parent().sortable("refreshPositions");
					},
					stop: fn.menu.sort_item,
					connectWith: "ul.item_wrapper"
				});

				// fn.menu.cat_activate.call($li);
			},

			render_item: function (item, should_refresh) {

				var $li = fn.menu.render_item_atom(item);
				$li.appendTo(fn.menu.$list.find('#item_wrapper_' + item.menu_id));
				plugin.init_uniform($li);
				$li.find('.is-active-toggler').togglebox().on('changed', fn.menu.isActiveChanged4Item);

				// Make newly added menu active
				var $menuLi = fn.menu.$list.find('#cat_' + item.menu_id);
				var $toggleObj = $menuLi.find('.full-toggle');
				if ( $toggleObj.hasClass('collapsed') ) {
					// We should enable this to open the items under the menu after added. Added by Daniel Lu.
					// If you want this commented out, please leave your description why do you need.
					// It means that it is just new item
					if ( item.id == '0' ) {
						$toggleObj.trigger('click');
					}

					fn.menu.click_full_toggle.call($toggleObj);
				}

				if (should_refresh) fn.menu.re_fresh ();
			},

			render_item_atom: function (item) {

				var $li = $('<li class="item" data-id="' + item.ref_id + '" id="item_' + item.menu_id + '_' + item.ref_id + '">');

				$li.append('<input data-val-skip="true" class="choose" type="checkbox" />');
				$li.append('<i class="handle-drag fa fa-arrows"></i>');
				$li.append('<div class="is-active-toggler togglebox ' + ((item.is_available == "0")?"":"checked") + '"></div>');
				$li.append('<div class="title">' + escapeHtml(item.item_name) + '</div>');

				var prev_active = item.is_available;
				if (item.is_available == '0') {
					if (fn.menu.is_custom_time(item)) {
						prev_active = '2';
					} else {
						prev_active = '1';
					}
				}
				$li.find('.is-active-toggler').data('prev_active', prev_active);
				

				/*
				if (item.is_available == '0') {
					$li.append('<div class="state-disabled">' + $phrases.build_label_inactive + '</div>');
				}
				*/

				var loc_count = item.locations.length;
				// var total_cnt = $('#item_locs option', fn.item_modal.$modal).length;
				var total_cnt = fn.loc.locData.length;
				if (loc_count == 0 || loc_count == total_cnt) {
					$li.append('<div class="location">' + $phrases.build_label_all_locations + '</div>');
				} else if (loc_count < 2) {
					$li.append('<div class="location">' + loc_count + ' ' + $phrases.build_label_location + '</div>');
				} else {
					$li.append('<div class="location">' + loc_count + ' ' + $phrases.build_label_locations + '</div>');
				}


				$li.append('<button class="btn-edit btn btn-dashboard btn-white"><i class="iconba icon-edit-single"></i></button>');
				$li.tooltip({
					placement: 'top', 
					title: $phrases.build_tip_missing_incorrect_info, 
					animation: false, 
					trigger: 'manual'
				}).clingTooltip();

				return $li
			},

			is_custom_time: function(item) {
				var default_time = {
					'open_time': "" + 7*60,
					'close_time': "" + 17*60,
					'more_time':[],
					'is_active': '1'
				};

				// let's check if all day is closed, then we d better make it open any time
				var is_closed_all_day = true;
				for(var ind=0; ind<item.ots.length; ind++) {
					if (item.ots[ind]['is_active'] != '0') {
						is_closed_all_day = false;
						break;
					}
				}
				if (is_closed_all_day) return false;

				// now let's see if this is custom time
				for(var ind=0; ind<item.ots.length; ind++) {
					var clone_time = jQuery.extend(true, {}, item.ots[ind]);
					delete clone_time['id'];
					if (!deepCompare(clone_time, default_time)) return true;
				}

				return false;
			},

			re_fresh_item_location: function (cat_id, id) {
				if (isNaN(cat_id) || cat_id < 0) return;
				if (isNaN(id) || id < 0) return;

				var ilocs = [];
				for (var ilind=0; ilind<fn.menu.itemData[cat_id]['items'][id].locations.length; ilind++) {
					var loc_ind_inItem = fn.menu.itemData[cat_id]['items'][id].locations[ilind];
					if (fn.loc.locData[loc_ind_inItem]) {
						ilocs.push("" + loc_ind_inItem);
					}
				}
				fn.menu.itemData[cat_id]['items'][id].locations = jQuery.extend(true, [], ilocs);
			},

			re_fresh_menu_locations: function () {
				$.each(fn.menu.$list.find('> li.cat'), function (idx, cat) {
					var section_count = $("li.item", $(cat)).length;
					var cat_id = $(cat).attr('data-id');
					if (section_count) {
						$.each($(cat).find('li.item input[type="checkbox"]'), function (idx, itm) {
							var $li = $(itm).parents('li.item').eq(0);
							var	id = $li.attr('data-id');

							// Need to apply location change if it s happend, so that removed locations wont be in item
							fn.menu.re_fresh_item_location(cat_id, id);
						});

					}
				});
			},

			update_order4cat: function () {
				var cats_indv = 0;
				var cats_count = fn.menu.$menu_wrap.find('li.cat').length;

				// set seq value
				$.each(fn.menu.$list.find('> li.cat'), function (idx, cat) {
					// Update seq and section
					var cat_id = $(cat).attr('data-id');

					fn.menu.itemData[cat_id].seq = cats_count - cats_indv;
					cats_indv ++;
				});
			},
			update_order4item: function (cat_id) {
				if (isNaN(cat_id) || cat_id < 0) return;
				var $cat = $('#cat_' + cat_id, fn.menu.$list),
				    section_count = $("li.item", $cat).length;
				var items_indv = 0;

				$.each($cat.find('li.item'), function (idx, itm) {
					// Update seq and section
					var	id = $(itm).attr('data-id');

					fn.menu.itemData[cat_id]['items'][id]['seq'] = section_count - items_indv;
					items_indv++;
				});
			},

			update_cat_count: function () {
				var cats_count = fn.menu.$list.find('li.cat').length;
				fn.menu.$menu_wrap.find('.count').html($phrases["build_content_cat_count"].replace('{count}', cats_count));
			},
			update_cat_item_count: function (cat_id) {
				var $cat = $('#cat_' + cat_id, fn.menu.$list),
				    section_count = $('li.item', $cat).length;
				$cat.find('.section-count').html(section_count + ' ' + $phrases.build_count_suffix_items);
			},

			update_cat_ui: function (cat_id, category) {
				if (isNaN(cat_id) || cat_id < 0) return;

				var $cat = $('#cat_' + cat_id, fn.menu.$list),
				    section_count = $("li.item", $cat).length;

				$('.section-count', $cat).html(section_count + ' ' + $phrases.build_count_suffix_items);
				$('.section-title', $cat).html(escapeHtml(fn.menu.itemData[cat_id].label));
			},
			update_item_ui: function (cat_id, id, item) {
				if (isNaN(cat_id) || cat_id < 0) return;
				if (isNaN(id) || id < 0) return;

				var $li = $('#item_' + cat_id + '_' + id, fn.menu.$list),
				   	id = $li.attr('data-id');

				$('.title', $li).html(escapeHtml(fn.menu.itemData[cat_id]['items'][id]['item_name']));

				var loc_str = '';
				var loc_count = fn.menu.itemData[cat_id]['items'][id].locations.length;
				var total_cnt = fn.loc.locData.length;
				// if (false && (loc_count == fn.loc.$list.find('li.location').length)) {
				if (loc_count == total_cnt) {
					loc_str = $phrases.build_label_all_locations;
				} else if (loc_count == 0) {
					loc_str = $phrases.build_label_all_locations;
				} else if (loc_count == 1) {
					loc_str = loc_count + ' ' + $phrases.build_label_location;
				} else {
					loc_str = loc_count + ' ' + $phrases.build_label_locations;
				}
				$('.location', $li).html(loc_str);
			},

			sort_cat: function (e, ui) {
				fn.menu.update_order4cat();
				fn.opts.$wrap.trigger('monitor');
			},

			sort_item: function (e, ui) {
				var $cat = ui.item.parentsUntil('ul.cat-list', 'li.cat.active'),
				    cat_id = $cat.attr('data-id');
				
				fn.menu.update_order4item(cat_id);
				fn.opts.$wrap.trigger('monitor');
			},

			re_fresh: function() {

				var cats_indv = 0;
				var items_indv = 0;
				var cats_count = fn.menu.$menu_wrap.find('li.cat').length;

				fn.menu.$menu_wrap.find('.count').html($phrases["build_content_cat_count"].replace('{count}', cats_count));


				// First let's adjust for category
				for (var kc = 0; kc < fn.menu.itemData.length; kc++) {
					if (fn.menu.itemData[kc] == undefined) continue;
					var old_cat_id = kc;
					for (var ki = 0; ki < fn.menu.itemData[kc]['items'].length; ki++) {
						var item = fn.menu.itemData[kc]['items'][ki];
						if (item == undefined) continue;

						var $li = $('#item_' + old_cat_id + '_' + item['ref_id']);
						var new_cat_id = parseInt($li.parents('li.cat').eq(0).attr('data-id'));

						if (new_cat_id != old_cat_id) {
							var ref_id = fn.menu.itemData[new_cat_id]['item_maxNo'];
							fn.menu.itemData[new_cat_id]['item_maxNo'] = fn.menu.itemData[new_cat_id]['item_maxNo'] + 1;

							item.ref_id = ref_id;
							item.menu_id = new_cat_id;

							fn.menu.itemData[new_cat_id]['items'][ref_id] = jQuery.extend(true, {}, item);
							$li.attr('data-id', ref_id).attr('id', 'item_' + new_cat_id + '_' + ref_id);
							delete fn.menu.itemData[old_cat_id]['items'][ki];
						}
					}
				}

				// And then set seq value
				$.each(fn.menu.$list.find('> li.cat'), function (idx, cat) {

					// Checkbox state update
					$(".choose-all", $(cat)).trigger('update_state');

					// Update seq and section
					var section_count = $("li.item", $(cat)).length;
					var cat_id = $(cat).attr('data-id');

					// $('.section-count', $(cat)).html(section_count + ' ' + $phrases.build_count_suffix_items);
					$('.section-title', $(cat)).html(escapeHtml(fn.menu.itemData[cat_id].label));
					fn.menu.itemData[cat_id].seq = cats_count - cats_indv;
					cats_indv ++;

					if (section_count) {
						items_indv = 0;
						$.each($(cat).find('li.item input[type="checkbox"]'), function (idx, itm) {

							// Update seq and section
							var $li = $(itm).parents('li.item').eq(0);
							var	id = $li.attr('data-id');
							var $ul = $li.parent();

							fn.menu.itemData[cat_id]['items'][id]['seq'] = section_count - items_indv;
							items_indv = items_indv + 1;

							$('.title', $li).html(escapeHtml(fn.menu.itemData[cat_id]['items'][id]['item_name']));
							var boxState = (fn.menu.itemData[cat_id]['items'][id]['is_available']=='0'?false:true);
							if (boxState) $li.find('.is-active-toggler').data('prev_active', fn.menu.itemData[cat_id]['items'][id]['is_available']);
							$li.find('.is-active-toggler').toggleboxSet(boxState);
							
							/*
							if (fn.menu.itemData[cat_id]['items'][id]['is_available'] == '0') {
								$li.append('<div class="state-disabled">' + $phrases.build_label_inactive + '</div>');
							} else {
								$li.find('.state-disabled').remove();
							}
							*/

							// Need to apply location change if it s happend, so that removed locations wont be in item
							fn.menu.re_fresh_item_location(cat_id, id);

							var loc_str = '';
							var loc_count = fn.menu.itemData[cat_id]['items'][id].locations.length;
							var total_cnt = fn.loc.locData.length;
							// if (false && (loc_count == fn.loc.$list.find('li.location').length)) {
							if (loc_count == total_cnt) {
								loc_str = $phrases.build_label_all_locations;
							} else if (loc_count == 0) {
								loc_str = $phrases.build_label_all_locations;
							} else if (loc_count == 1) {
								loc_str = loc_count + ' ' + $phrases.build_label_location;
							} else {
								loc_str = loc_count + ' ' + $phrases.build_label_locations;
							}
							$('.location', $li).html(loc_str);


						});

					} else {
						// Empty Section will be removed from the view
						fn.menu.itemData[cat_id]['items'] = [];
					}

				});

				fn.opts.$wrap.trigger('monitor');
			},


			chooseAll: function (e) {

				var $tbody = $(this).parents('.panel').eq(0);
				var $choose = $tbody.find('input[type="checkbox"].choose');

				$choose.prop('checked', $(this).find('input').is(':checked'));
				$.uniform.update($choose);

				$(this).trigger('update_state');
			},

			updateRemoveBtnState: function () {
				var overalActiveCount = fn.menu.$list.find('input[type="checkbox"]').filter(':checked').length;
				if (overalActiveCount) {
					fn.menu.$remove.removeAttr('disabled');
				} else {
					fn.menu.$remove.attr('disabled', true);
				}
			},

			updateChooseAllState: function (e) {

				var $tbody = $(this).parents('.panel').eq(0);
				var $choose = $tbody.find('input[type="checkbox"].choose');
				var count = $choose.length,
					activeCount = $choose.filter(':checked').length,
					$chooseAllCheck = $tbody.find('input[type="checkbox"].check-all');

				
				/* update menu category checkbox state */
				if ((count > 0) && (activeCount == count)) {
					$chooseAllCheck.prop('checked', true);
					// $(this).find('.checker').toggleClass('partial', count != activeCount);
				} else if(count > 0) {
					$chooseAllCheck.prop('checked', false);
				}
				
				fn.menu.updateRemoveBtnState();

				$.uniform.update($chooseAllCheck);
			},

			updateGobalChooseAllState: function (e) {
				$(".choose-all", fn.menu.$list).each(function(iind, o) {
					$(o).trigger('update_state');
				});
			},

			choose: function(e) {
				var $tbody = $(this).parents('.panel').eq(0);
				var $chooseAllCheck = $tbody.find('input[type="checkbox"].check-all');
				$chooseAllCheck.prop('checked', false);
				$.uniform.update($chooseAllCheck);
				
				fn.menu.updateRemoveBtnState();
			},


			beforeRemove: function () {

				var $choose = fn.menu.$list.find('li.item input[type="checkbox"]');
					$activeItems = $choose.filter(':checked');

				var $cat_choose = fn.menu.$list.find('.check-all');
				var $active_cats = $cat_choose.filter(':checked');


				/*
				$.each(fn.menu.$list.find('> li.cat'), function (idx, cat) {

					$.each($(cat).find('li.item input[type="checkbox"]'), function (idx, itm) {

					});

				});
				*/	



				var items_to_delete = $.map($activeItems, function(itm) {

					var $li = $(itm).parents('li.item').eq(0);
					var idv = $li.attr('data-id');
					var cat_ind = $li.parents('li.cat').eq(0).attr('data-id');
					var item_name = escapeHtml(fn.menu.itemData[cat_ind]['items'][idv]['item_name']);

					return '<li class="item"> - '/* + indv + '.'*/ + item_name + '</li>';
				}).join('');

				var menu_to_delete = $.map($active_cats, function(itm) {

					var $li = $(itm).parents('li.cat').eq(0);
					var idv = $li.attr('data-id');

					if (($('li.item', $li).length > 0) && false) {
						return '';
					} else {
						var cat_name = escapeHtml(fn.menu.itemData[idv]['label']);
						return '<li class="item"> - '/* + indv + '.'*/ + cat_name + '</li>';
					}
				}).join('');

				if ((items_to_delete == '') && (menu_to_delete == '')) {
					return false;
				}

				var confirm_msg = '<li>' + $phrases.build_label_items + '</li>';
				confirm_msg = confirm_msg + items_to_delete;
				if (menu_to_delete != '') {
					confirm_msg = confirm_msg + '<li style="margin-top: 10px;">' + $phrases.build_label_categories + '</li>';
					confirm_msg = confirm_msg + menu_to_delete;
				}

				$(this.modal).trigger('updateCheckList', [confirm_msg]);
				return true;
			},

			remove: function () {
				// remove category first
				var $cat_choose = fn.menu.$list.find('.check-all');
				var $active_cats = $cat_choose.filter(':checked');

				$.each($active_cats, function (idx, itm) {
					var $li = $(this).parents('li.cat');
					var idv = $li.attr('data-id');

					if (($('li.item', $li).length > 0) && false) {
					} else {
						$li.remove();
						if (fn.menu.itemData[idv].id != '0') {
							if (fn.menu.removedCats == undefined) fn.menu.removedCats = [];
							fn.menu.removedCats.push(fn.menu.itemData[idv].id);
						}
						delete fn.menu.itemData[idv];
					}
				});


				// remove items
				var $choose = fn.menu.$list.find('li.item input[type="checkbox"]');
					$checked = $choose.filter(':checked');

				// Remove items.
				$.each($checked, function (idx, itm) {
					var $li = $(this).parents('li.item');
					var ind = $li.attr("data-id");
					var cat_ind = $li.parents('li.cat').eq(0).attr('data-id');

					$li.remove();
					if (fn.menu.itemData[cat_ind]['items'][ind].id != '0') {
						if (fn.menu.itemData[cat_ind].removedItems == undefined) fn.menu.itemData[cat_ind].removedItems = [];
						fn.menu.itemData[cat_ind].removedItems.push(fn.menu.itemData[cat_ind]['items'][ind]);
					}
					delete fn.menu.itemData[cat_ind]['items'][ind];
				});


				fn.menu.choose();
				fn.menu.re_fresh();
			},

			is_valid: function () {
				// if (!fn.is_init_done) return true;

				var valid = true;
				var is_error = false;
				// fn.ordering.highlight_submenu('div_sub_menu', false);

				if (!fn.menu.check_data_valid()) {
					// fn.ordering.highlight_submenu('div_sub_menu');
					is_error = true;
					// valid = false;
				}

				fn.ordering.highlight_submenu('div_sub_menu', is_error);

				return valid;
			},

			check_data_valid: function () {
				var valid = true,
				    $cats = $('li.cat', fn.menu.$list);

				$.each($cats, function (idx, cat) {
					var id = $(cat).attr('data-id'),
					    category = fn.menu.itemData[id];
					if (category == undefined) return;

					fn.menu.highlight_item($(cat).find('.panel-heading'), false);
					if (fn.menu.check_cat_valid(category) == false) {
						fn.menu.highlight_item($(cat).find('.panel-heading'));
						valid = false;
					}
					/* check if category is changed or not */
					if (fn.opts.data.menuData[id] != undefined && doCompare(category, fn.opts.data.menuData[id], true, ['items', 'removedItems', 'changed']))
						fn.menu.itemData[id].changed = false;
					else
						fn.menu.itemData[id].changed = true;

					$.each($('li.item', $(cat)), function (ind, itm) {
						var itm_id = $(itm).attr('data-id'),
						    item = fn.menu.itemData[id]['items'][itm_id];
						if (item == undefined) return;

						fn.menu.highlight_item($(itm), false);
						if (fn.menu.check_item_valid(item) == false) {
							fn.menu.highlight_item($(itm));
							valid = false;
						}
						/* check if item is changed or not */
						if (fn.opts.data.menuData[id] != undefined && fn.opts.data.menuData[id]['items'][itm_id] != undefined && doCompare(item, fn.opts.data.menuData[id]['items'][itm_id], true, ['changed']))
							fn.menu.itemData[id]['items'][itm_id].changed = false;
						else
							fn.menu.itemData[id]['items'][itm_id].changed = true;
					});
				});

				return valid;
			},

			check_cat_valid: function (cat) {
				if (cat.label == '') return false;
				if (cat.thumb_url != '' && !isValidURL(cat.thumb_url)) return false;
				return true;
			},

			check_item_valid: function (item) {
				if (item.item_name == '') return false;
				if (item.thumb_url != '' && !isValidURL(item.thumb_url)) return false;
				if (isNaN(parseFloat(item.price)) || parseFloat(item.price) < 0) return false;
				return true;
			},

			highlight_item: function ($item, status) {
				if (status == undefined || status != false) status = true;
				if (status) {
					$item.addClass('missing-info');
					$item.tooltip('enable');
				} else {
					$item.removeClass('missing-info');
					$item.tooltip('disable');
				}
			}
		},

		cat_modal: {

			$modal: null,

			$btn_save: null,
			$btn_cancel: null,
			$dlg_title: null,

			currentEditId: null,

			vflyup: {
				init_count: 0,
				init_done: false,

				init: function() {
					var dim = g_vars.dimensions.ordering_menu;
					var picker_cnt = $(".img-picker-ordering-cat", fn.cat_modal.$modal).length;

					$(".img-picker-ordering-cat", fn.cat_modal.$modal).flyup({
						name: "ordering_menu_image",
						category: "ordering_menu",
						devices: ["all"],
						is_vertical: true,

						dimension: {
							all: dim.all.thumb
						},
						list: 	  {	all: g_vars.ordering_menu },

						onSave: function() {
							// fn.modal.monitor();
							$('#cat_img_url', fn.cat_modal.$modal).val('');
							fn.cat_modal.inner_monitor();
						},

						onReloaded: function () {
							fn.cat_modal.vflyup.init_count++;
							if (fn.cat_modal.vflyup.init_count >= picker_cnt) {
								fn.cat_modal.vflyup.init_done = true;
								fn.flyup_loaded();
							}
						}
					});


				}
			},

			init: function() {

				fn.cat_modal.$modal = $('#edit_ordering_cat_modal');
				fn.cat_modal.$btn_save = fn.cat_modal.$modal.find(".btn-save");
				fn.cat_modal.$btn_cancel = fn.cat_modal.$modal.find(".btn-cancel");
				fn.cat_modal.$dlg_title = fn.cat_modal.$modal.find(".modal-title");

				fn.cat_modal.$modal.on('change keyup focus blur', 'input, select', fn.cat_modal.inner_monitor);
				fn.cat_modal.$btn_save.on('click', fn.cat_modal.save);

				fn.cat_modal.vflyup.init();
				$('#cat_img_url', fn.cat_modal.$modal).on('blur', fn.cat_modal.check_protocol);
			},

			switchEditType: function (isAdd) {
				var dataLabel = isAdd ? 'data-add-label' : 'data-edit-label';
				fn.cat_modal.$dlg_title.html(fn.cat_modal.$dlg_title.attr(dataLabel));
				fn.cat_modal.$btn_save.html(fn.cat_modal.$btn_save.attr(dataLabel));
			},

			invalid_input: function (show_error) {
				if (show_error == undefined) show_error = false;

				var $url = $('#cat_img_url', fn.cat_modal.$modal),
				    url = $url.val(),
				    url_invalid = (url != '' && !(isValidURL(url) || isValidURL('http://' + url))),
				    invalid = false;
				// if (url_invalid) invalid = true;

				if (show_error) {
					$url.siblings('.msg.error').remove();
					if (url_invalid) {
						$url.parent().append('<div class="msg right error">' + $phrases.build_modal_url_invalid + '</div>');
					}
				}

				return invalid;
			},

			check_protocol: function() {
				var $url = $('#cat_img_url', fn.cat_modal.$modal),
				    url = $url.val().trim(),
				    invalid = !(isValidURL(url) || isValidURL('http://' + url));

				if (!invalid && (!/^(ht)tps?:\/\//i.test(url))) {
					$url.val('http://' + url);
				}

				fn.cat_modal.inner_monitor();
			},

			inner_monitor: function() {
				var is_filled = true;

				if ($('#cat_name', fn.cat_modal.$modal).val().trim() == '') is_filled = false;
				// if (($('#cat_img', fn.cat_modal.$modal).val() == '') && ($('#cat_img_url', fn.cat_modal.$modal).val().trim() == '')) is_filled = false;

				// Now lets check for modal change
				var cat = {};
				if (fn.cat_modal.currentEditId === false) {
					cat = fn.cat_modal.get_empty ();
				} else {
					cat = fn.menu.itemData[fn.cat_modal.currentEditId];
				}
				var new_cat = fn.cat_modal.inputData();
				var is_same = deepCompare(cat, new_cat);
				var invalid = fn.cat_modal.invalid_input(true);

				if (!invalid && is_filled && !is_same) {
					fn.cat_modal.$btn_save.removeAttr('disabled');
				} else {
					fn.cat_modal.$btn_save.attr('disabled', true);
				}
			},

			get_empty: function() {
				return {
					'id': '0',
					'label': '',
					'is_active': '1',

					'thumb_id': '',
					'thumb_filename': '',
					'thumb_link': '',
					'thumb_url': '',
					'items': [],

					'ref_id': fn.menu.item_maxNo,
					'seq': 0,
					'item_maxNo': 0
				};
			},

			fill: function(cat) {
				$('#cat_name', fn.cat_modal.$modal).val(cat.label);
				$('#cat_img', fn.cat_modal.$modal).val(cat.thumb_id);
				$('#cat_img_filename', fn.cat_modal.$modal).val(cat.thumb_filename);
				$('#cat_img_link', fn.cat_modal.$modal).val(cat.thumb_link);
				$('#cat_img_url', fn.cat_modal.$modal).val(cat.thumb_url);
			},

			edit: function() {
				fn.cat_modal.switchEditType((fn.cat_modal.currentEditId === false));
				if (fn.cat_modal.currentEditId === false) {
					fn.cat_modal.fill(fn.cat_modal.get_empty());
				} else {
					fn.cat_modal.fill(fn.menu.itemData[fn.cat_modal.currentEditId]);
				}

				fn.opts.$wrap.trigger('onUpdateFlyupAgent');
				fn.cat_modal.inner_monitor();
				fn.cat_modal.$modal.modal('show');
			},

			inputData: function() {

				var cat = fn.cat_modal.get_empty();
				if (fn.cat_modal.currentEditId !== false) {
					cat = jQuery.extend(true, {}, fn.menu.itemData[fn.cat_modal.currentEditId]);
				}

				cat.label = $('#cat_name', fn.cat_modal.$modal).val();
				cat.thumb_id = $('#cat_img', fn.cat_modal.$modal).val();
				cat.thumb_filename = $('#cat_img_filename', fn.cat_modal.$modal).val();
				cat.thumb_link = $('#cat_img_link', fn.cat_modal.$modal).val();
				cat.thumb_url = $('#cat_img_url', fn.cat_modal.$modal).val();

				return cat;
			},

			save: function() {
				fn.cat_modal.check_protocol();

				var cat = fn.cat_modal.inputData();

				if (fn.cat_modal.currentEditId !== false) {
					fn.menu.itemData[fn.cat_modal.currentEditId] = cat;
					fn.menu.update_cat_ui(fn.cat_modal.currentEditId, cat);
				} else {
					fn.menu.itemData[fn.menu.item_maxNo] = cat;
					fn.menu.item_maxNo = fn.menu.item_maxNo + 1;
					fn.menu.render_cat(cat);
					fn.menu.update_cat_count();
					fn.menu.update_order4cat();
				}

				fn.cat_modal.$modal.modal('hide');
				fn.do_monitor();
			}
		},

		item_modal: {

			$modal: null,

			$btn_save: null,
			$btn_cancel: null,
			$dlg_title: null,

			currentEditCatId: null,
			currentEditId: null,
			item_price: 0,
			vflyup: {
				init_count: 0,
				init_done: false,

				init: function() {
					var dim = g_vars.dimensions.thumb;
					var picker_cnt = $(".img-picker-ordering-item", fn.item_modal.$modal).length;

					$(".img-picker-ordering-item", fn.item_modal.$modal).flyup({
						name: "product_img",
						category: "product",
						devices: ["all"],
						is_vertical: true,

						dimension: {
							all: dim.all.thumb
						},
						list: 	  {	all: g_vars.product },

						onSave: function() {
							// fn.modal.monitor();
							$('#item_img_url', fn.item_modal.$modal).val('');
							fn.item_modal.inner_monitor();
						},

						onReloaded: function () {
							fn.item_modal.vflyup.init_count++;
							if (fn.item_modal.vflyup.init_count >= picker_cnt) {
								fn.item_modal.vflyup.init_done = true;
								fn.flyup_loaded();
							}
						}
					});


				}
			},

			loc_ms: {

				init: function() {
					

					if ($('#item_locs', fn.item_modal.$modal).multiselect) {
						$('#item_locs', fn.item_modal.$modal).multiselect('destroy');
					}

					$('#item_locs', fn.item_modal.$modal).html('');

					// $('#item_locs', fn.item_modal.$modal).append('<option value="">' + $phrases["build_label_select_location"] + '</option>');
					var locs = jQuery.extend(true, [], fn.loc.locData);
					for (var keyv = 0; keyv < locs.length; keyv++) {
						var label = fn.loc.get_display_address(locs[keyv]);
						$('#item_locs', fn.item_modal.$modal).append('<option value="' + keyv + '">' + escapeHtml(label) + '</option>');
					}

					$('#item_locs', fn.item_modal.$modal).multiselect({
						buttonWidth: '100%',
						buttonContainer: '<div class="btn-group btn-group-bs-multiselect" />',
						numberDisplayed: 1,
						nonSelectedText: $phrases['build_label_select_location(s)'],
						includeSelectAllOption: true,
						selectAllText: $phrases.build_label_check_all,
						enableFiltering: true,
						enableCaseInsensitiveFiltering: true,

						buttonText: function (options, select) { // order changed to show the selected locations label
							if (options.length === 0) {
								return $phrases['build_label_all_locations'];
								// return $phrases['build_label_select_location(s)'];
							} else if (false && (options.length == $(select).find('option').length)) {
								return $phrases['build_label_all_locations'];
							} else if (options.length == 1) {
								return escapeHtml($(options).html());
							} else {
								return options.length + ' ' + $phrases['build_label_location(s)'];
							}
						},
						height: 300
					});

					$('#item_locs', fn.item_modal.$modal).multiselect('rebuild');


				},

				clear: function() {
					$('#item_locs', fn.item_modal.$modal).multiselect('deselectAll', false);
				},

				apply: function(item) {
					$('#item_locs', fn.item_modal.$modal).multiselect('select', item.locations);
					$('#item_locs', fn.item_modal.$modal).multiselect('refresh');
				},

				rebuild: function() {
					$('#item_locs', fn.item_modal.$modal).multiselect('rebuild');
				}
			},

			opt: {
				$wrap: null,
				$list: null,
				$remove: null,
				$chooseAll: null,
				ind: null,

				init: function() {

					fn.item_modal.opt.$wrap = $('#item_tab_12', fn.item_modal.$modal);
					fn.item_modal.opt.$list = $('#option_list_cedar', fn.item_modal.opt.$wrap);
					fn.item_modal.opt.$remove = $('.btn-trash-opt-cedar', fn.item_modal.opt.$wrap);
					fn.item_modal.opt.$chooseAll = $('.check-all-global', fn.item_modal.opt.$wrap);

					fn.item_modal.opt.ind = 0;

					fn.item_modal.opt.$wrap.on('change', '.choose-all', fn.item_modal.opt.chooseAll);
					fn.item_modal.opt.$wrap.on('update_state', '.choose-all', fn.item_modal.opt.updateChooseAllState);
					fn.item_modal.opt.$wrap.on('change', 'input[type="checkbox"].choose', fn.item_modal.opt.choose);

					fn.item_modal.opt.$wrap.on('change', '.choose-all-global', fn.item_modal.opt.chooseAllGlobal);
					fn.item_modal.opt.$wrap.on('update_state', '.choose-all-global', fn.item_modal.opt.updateChooseAllGlobalState);

					fn.item_modal.opt.$list.on('change', 'input[type="checkbox"].allow_qty, input[type="checkbox"].is_required', fn.item_modal.opt.re_fresh);

					fn.item_modal.opt.$remove.bind_confirm({
						name: 'remove-option-cedar',
						onSubmit: fn.item_modal.opt.remove
					});

					$('#btn_add_type_cedar', fn.item_modal.opt.$wrap).on('click', fn.item_modal.opt.add_new_type);
					$('#btn_add_option_cedar', fn.item_modal.opt.$wrap).on('click', fn.item_modal.opt.add_new_option);

					fn.item_modal.opt.$list.on('click', 'li.type', function(){
						$(this).addClass('active').siblings().removeClass('active');
					});


					fn.item_modal.opt.$wrap.find('.option-list').sortable({
						items: '.type-normal',
						revert: false,
						opacity: 0.5,
						helper: 'clone',
						handle: '.section-drag',
						axis: 'y',
						start: function(e, ui) {
							$(ui.item).parent().sortable("refreshPositions");
						},
						stop: fn.item_modal.opt.re_fresh
					});
				},
				
				isActiveChanged4Option: function(e) {
					// Refresh required amount selectbox
					var $liType = $(this).closest('li.type');

					var old_val = parseInt($('.opt_type_amount', $liType).val());
					if (isNaN(old_val)) old_val = parseInt($('.opt_type_amount', $liType).attr('init-val'));
					if (isNaN(old_val)) old_val = 0;

					$('.opt_type_amount', $liType).html('');

					var opt_count = $('li.item .is-active-toggler.checked', $liType).length;
					if (opt_count < 1) {
						if ( $liType.find('.is_required').prop('checked') ) {
							$liType.find('.is_required_wrap .checked').removeClass('checked');
							$liType.find('.is_required').prop('checked', false);
							$liType.find('.limit').fadeOut(100);
						}
					} else {
						for (var i=1; i<=opt_count; i++) {
							$('.opt_type_amount', $liType).append('<option value="' + i + '">' + i + '</option>');
						}
						if (old_val > opt_count) old_val = opt_count;
					}

					plugin.init_selectbox({
						selector: $('.opt_type_amount', $liType),
						width: '50px'
					});

					fn.item_modal.inner_monitor();
				},

				chooseAll: function (e) {

					var $tbody = $(this).parents('.panel').eq(0);
					var $choose = $tbody.find('input[type="checkbox"].choose');

					$choose.prop('checked', $(this).find('input').is(':checked'));
					$.uniform.update($choose);

					$(this).trigger('update_state');
				},

				chooseAllGlobal: function (e) {

					var $choose = fn.item_modal.opt.$list.find('input[type=checkbox].choose, input[type=checkbox].check-all');

					$choose.prop('checked', $(this).find('input').is(':checked'));
					$.uniform.update($choose);

					$(this).trigger('update_state');
				},

				updateChooseAllState: function (e) {

					/*
					var $tbody = $(this).parents('.panel').eq(0);
					var $choose = $tbody.find('input[type="checkbox"].choose');
					var count = $choose.length,
						activeCount = $choose.filter(':checked').length,
						$chooseAllCheck = $tbody.find('input[type="checkbox"].check-all');

					
					if ((count > 0) && (activeCount == count)) {
						$chooseAllCheck.prop('checked', true);
						// $(this).find('.checker').toggleClass('partial', count != activeCount);
					} else if(count > 0) {
						$chooseAllCheck.prop('checked', false);
					}

					$.uniform.update($chooseAllCheck);
					*/
					
					fn.item_modal.opt.$chooseAll.trigger('update_state');
				},

				updateChooseAllGlobalState: function (e) {
					var overalActiveCount = fn.item_modal.opt.$list.find('input[type="checkbox"].choose, input[type="checkbox"].check-all').filter(':checked').length;
					var overalCount = fn.item_modal.opt.$list.find('input[type="checkbox"].choose, input[type="checkbox"].check-all').length;
					fn.item_modal.opt.$chooseAll.prop('checked', false);

					if (overalActiveCount) {
						fn.item_modal.opt.$remove.removeAttr('disabled');

						if (overalActiveCount == overalCount) {
							fn.item_modal.opt.$chooseAll.prop('checked', true);
						}

					} else {
						fn.item_modal.opt.$remove.attr('disabled', true);
					}
					$.uniform.update(fn.item_modal.opt.$chooseAll);
				},

				choose: function(e) {
					var $tbody = $(this).parents('.panel').eq(0);
					var $chooseAllCheck = $tbody.find('input[type="checkbox"].check-all');
					if ($chooseAllCheck.length > 0) {
						$chooseAllCheck.trigger('update_state');	
					} else {
						fn.item_modal.opt.$chooseAll.trigger('update_state');
					}
					
				},

				remove: function () {
					// remove category first
					var $cat_choose = fn.item_modal.opt.$list.find('.check-all');
					var $active_cats = $cat_choose.filter(':checked');

					$.each($active_cats, function (idx, itm) {
						var $li = $(this).parents('li.type').eq(0);
						$li.remove();

						/*
						if ($('li.item', $li).length > 0) {
						} else {
							$li.remove();
						}
						*/
					});


					// remove items
					var $choose = fn.item_modal.opt.$list.find('li.item input[type="checkbox"].choose');
						$checked = $choose.filter(':checked');

					// Remove items.
					$.each($checked, function (idx, itm) {
						var $li = $(this).parents('li.item');
						$li.remove();
					});

					fn.item_modal.opt.re_fresh();

				},

				re_fresh: function() {

					$(".choose-all", fn.item_modal.opt.$wrap).each(function(iind, o) {
						$(o).trigger('update_state');
					});
					fn.item_modal.opt.$chooseAll.trigger('update_state');

					$.each(fn.item_modal.opt.$list.find('li.type'), function(i, o){
						if($('.is_required', $(o)).is(':checked')) {
							$('.limit', $(o)).show();
						} else {
							$('.limit', $(o)).hide();
						}

						var old_val = parseInt($('.opt_type_amount', $(o)).val());
						if (isNaN(old_val)) old_val = parseInt($('.opt_type_amount', $(o)).attr('init-val'));
						if (isNaN(old_val)) old_val = 0;

						var opt_count = $('li.item .is-active-toggler.checked', $(o)).length;
						if (opt_count < 1) opt_count = 1;
						$('.opt_type_amount', $(o)).html('');
						for (var i=1; i<=opt_count; i++) {
							$('.opt_type_amount', $(o)).append('<option value="' + i + '">' + i + '</option>');
						}
						if (old_val > opt_count) old_val = opt_count;
						plugin.init_selectbox({
							selector: $('.opt_type_amount', $(o)),
							width: '50px'
						});
						if (isNaN(old_val) || (old_val == '0')) old_val = '1';
						$('.opt_type_amount', $(o)).val(old_val).trigger('change');

						$.each($('li.item', $(o)), function(ii, oo){
							if ($('.allow_qty', $(oo)).is(':checked')) {
								$('.max', $(oo)).show();
							} else {
								$('.max', $(oo)).hide();
							}

							var opt_max = parseInt($('.opt_max', $(oo)).val());
							if (isNaN(opt_max) || (opt_max === 0)) opt_max = $phrases.build_label_unlimited;
							$('.opt_max', $(oo)).val(opt_max);
						});
					});
				},


				render_type: function (cat) {

					var cat_class = 'type-normal';
					if (cat.is_default == '1') cat_class = 'type-default';

					var $li = $('<li class="type ' + cat_class + '" data-id="' + cat.id + '"></li>');

					var innerEleme = '<div class="panel panel-default">' +
									 '<div class="panel-heading" role="tab" id="opt_section_header_' + fn.item_modal.opt.ind + '" style="text-transform: none;">';
					if (cat.is_default == '0') {
						innerEleme = innerEleme + '<div class="choose-all"><input type="checkbox" class="check-all"></div>' +
									 '<i class="section-drag fa fa-arrows"></i>';
					} else {
						innerEleme = innerEleme  + '<label class="sign">' + $phrases.build_label_default + '</label>';
					}
					innerEleme = innerEleme  +
									  	'<div class="is-active-toggler togglebox ' + ((cat.is_active == "1")?"checked":"") + '"></div>' + 
									  	'<span class="title"><div class="input-group form-group" style="margin-bottom: 0px;"><input type="text" class="opt_type_name form-control" value="' + escapeHtml(cat.type_name) + '"><span class="input-group-addon">' + $phrases['build_label_type'] + ' <span class="required-mark">*</span></span></div></span>' + 
									  	'<span class="is_required_wrap"><input type="checkbox" class="is_required" ' + ((cat.is_required=='1')?'checked="checked"':'') + '></span>' +
									  	'<span>' + $phrases['build_label_required'] + '</span>' + 
									  	'<span class="limit"><div class="input-group"><select class="opt_type_amount form-control select2" init-val="' + cat.min_selection + '"></select><span class="input-group-addon">' + $phrases['build_label_amount'] + '</span></div></span>' + 
										'<a data-toggle="collapse" href="#opt_section_body_' + fn.item_modal.opt.ind + '" aria-expanded="true" aria-controls="section_' + cat.ref_id + '" class="full-toggle"><i class="fa ic-toggle"></i></a>' +
										
									  '</div>' +

									  '<div id="opt_section_body_' + fn.item_modal.opt.ind + '" class="panel-collapse collapse in" role="tabpanel" aria-labelledby="opt_section_header_' + fn.item_modal.opt.ind + '">' +
										'<div class="panel-body">' +
										  '<div class="row col-lg-12">' +

												'<ul class="item_wrapper" data-id="' + cat.id + '">' +
						  						'</ul>' +

										  '</div>' +
										'</div>' +
									  '</div>' +
									'</div>';

					$li.append(innerEleme);
					$li.appendTo(fn.item_modal.opt.$list);
					plugin.init_uniform($li);
					$li.find('.is-active-toggler').togglebox().on('changed', fn.item_modal.inner_monitor);

					for (var x=0; x<cat.opt.length; x++) {
						fn.item_modal.opt.render_item(cat.opt[x], $li.find('.item_wrapper'));
					}

					$li.find('.item_wrapper').sortable({
						items: '.item',
						revert: false,
						opacity: 0.5,
						helper: 'clone',
						handle: '.handle-drag',
						axis: 'y',
						start: function(e, ui) {
							$(ui.item).parent().sortable("refreshPositions");
						},
						stop: fn.item_modal.opt.re_fresh,
						connectWith: ".option-list ul.item_wrapper"
					});

					fn.item_modal.opt.ind = fn.item_modal.opt.ind + 1;

					return $li;

				},

				render_item: function (item, wrapper) {

					var $li = $('<li class="item" data-id="' + item.id + '">');

					$li.append('<input data-val-skip="true" class="choose" type="checkbox" />');
					$li.append('<i class="handle-drag fa fa-arrows"></i>');
					$li.append('<div class="is-active-toggler togglebox ' + ((item.is_shown == "1")?"checked":"") + '"></div>');

					$li.append('<span class="size"><div class="input-group"><input type="text" class="opt_value form-control" value="' + escapeHtml(item.option_name) + '" /><span class="input-group-addon">' + $phrases.build_label_option + '</span></div></span');
					$li.append('<span class="price"><div class="input-group"><input type="text" class="opt_price form-control" value="' + escapeHtml(item.option_charges) + '" /><span class="input-group-addon">' + $phrases.build_label_charges + '(' + fn.payment.get_current_currency() + ')</span></div></span>');
					$li.append('<span class="allow_qty"><input data-val-skip="true" class="allow_qty" type="checkbox" ' + ((item.allow_qty=='1')?'checked="checked"':'') + ' /></span>');
					$li.append('<span>' + $phrases.build_label_allow_qty + '?</span>');
					$li.append('<span class="max"><div class="input-group"><input type="text" class="opt_max form-control" value="' + escapeHtml(item.max_qty) + '" /><span class="input-group-addon">' + $phrases.build_label_max + '</span></div></span');

					$li.appendTo($(wrapper));
					plugin.init_uniform($li);

					$li.find('.is-active-toggler').togglebox().on('changed', fn.item_modal.opt.isActiveChanged4Option);
				},

				get_empty_type: function(is_default) {
					return {
						'id': '0', 
						'seq': 1, 
						// 'item_id', 
						'type_name': (is_default ? $phrases.build_label_default_options : ''), 
						'is_required': '0', 
						'min_selection': '0', 
						'is_active': '1',
						'is_default': (is_default?'1':'0'),
						'opt': []
					};
				},

				get_empty_item: function() {
					return {
						'id': '0', 
						// 'seq': 1, 
						// 'item_id', 
						'option_name': '', 
						'option_charges': '0', 
						'is_shown': '1',
						'allow_qty': '0',
						'max_qty': '0'
					};
				},

				add_new_type: function() {
					var new_cat = fn.item_modal.opt.get_empty_type(false);
					new_cat['opt'][0] = fn.item_modal.opt.get_empty_item();

					fn.item_modal.opt.render_type(new_cat);

					fn.item_modal.opt.re_fresh();
				},

				add_new_option: function() {
					var $li = fn.item_modal.opt.$list.find('>li.active');
					if ($li.length < 1) {
						$li = fn.item_modal.opt.$list.find('>li').eq(0);
					}
					if ($li.length < 1) {
						// is this case possible???
						var default_opt = fn.item_modal.opt.get_empty_type(true);
						$li = fn.item_modal.opt.render_type(default_opt);
					}

					fn.item_modal.opt.render_item(fn.item_modal.opt.get_empty_item(), $li.find('.item_wrapper'));

					fn.item_modal.opt.re_fresh();
				},

				build: function(item) {

					fn.item_modal.opt.ind = 0;
					fn.item_modal.opt.$list.html('');

					var opts = item.opt;
					if (opts.length < 1) {
						opts = [fn.item_modal.opt.get_empty_type(true)];
					} else {
						if (opts[0]['is_default'] != '1') {
							opts.unshift(fn.item_modal.opt.get_empty_item(true));
						}
					}


					if (opts[0]['opt'].length < 1) {
						for (var xi=0; xi<3; xi++) {
							opts[0]['opt'][xi] = fn.item_modal.opt.get_empty_item();
						}
					}

					for (var oi=0; oi<opts.length; oi++) {
						fn.item_modal.opt.render_type(opts[oi]);
					}

					fn.item_modal.opt.re_fresh();
				},

				get_data: function() {
					
					var optset = [];

					var type_count = fn.item_modal.opt.$list.find('li.type').length;
					var type_ind = 0;

					$.each(fn.item_modal.opt.$list.find('li.type'), function(i, o){

						var min_selection = $('.opt_type_amount', $(o)).val();
						if (min_selection == null) min_selection = '0';
						var cat = {
							'id': $(o).attr('data-id'), 
							// 'item_id', 
							'type_name': $('.opt_type_name', $(o)).val(), 
							'is_required': $('.is_required', $(o)).is(':checked')?'1':'0', 
							'min_selection': min_selection, 
							'is_active': '1',
							'is_default': $(o).hasClass('type-default')?'1':'0',
							'seq': type_count - type_ind,
							'opt': []
						};

						if (($('.panel-heading .is-active-toggler', $(o)).length > 0) && (!$('.panel-heading .is-active-toggler', $(o)).data('checked'))) {
							cat['is_active'] = '0';
						}

						$.each($('li.item', $(o)), function(ii, oo){
							if ( $('.opt_value', $(oo)).val().trim() != '' && parseFloat( $('.opt_price', $(oo)).val().trim() ) >= 0 ) {
								var opt_max = parseInt($('.opt_max', $(oo)).val());
								if (isNaN(opt_max)) {
									opt_max = '0';
								} else {
									opt_max = '' + opt_max;
								}


								var opt = {
									'id': $(oo).attr('data-id'), 
									// 'item_id', 
									'option_name': $('.opt_value', $(oo)).val(), 
									'option_charges': $('.opt_price', $(oo)).val(), 
									'is_shown': $('.is-active-toggler', $(oo)).data('checked')?'1':'0',
									'allow_qty': $('.allow_qty', $(oo)).is(':checked')?'1':'0', 
									'max_qty': opt_max,
									'seq': 0, 
								};

								cat['opt'].push(opt);
							}
						});

						var opt_count = cat['opt'].length;
						for (var opt_ind=0; opt_ind<opt_count; opt_ind++) {
							cat['opt'][opt_ind]['seq'] = opt_count - opt_ind;
						}

						type_ind = type_ind + 1;

						optset.push(cat);

					});

					return optset;

				}
			},

			init: function() {

				fn.item_modal.$modal = $('#edit_ordering_item_modal');
				fn.item_modal.$btn_save = fn.item_modal.$modal.find(".btn-save");
				fn.item_modal.$btn_cancel = fn.item_modal.$modal.find(".btn-cancel");
				fn.item_modal.$dlg_title = fn.item_modal.$modal.find(".modal-title");

				fn.item_modal.currentEditCatId = null;
				fn.item_modal.currentEditId = null;

				fn.item_modal.$btn_save.on('click', fn.item_modal.save);
				$('.tax-out-toggler', fn.item_modal.$modal).togglebox().on('changed', fn.item_modal.inner_monitor);

				plugin.init_selectbox({
					selector: $('.select2', fn.item_modal.$modal)
				});

				fn.item_modal.$modal.on('blur focus', '.size_price, .opt_price, #item_price', function(e){
					var v = parseFloat($(this).val());
					if (isNaN(v)) v = ''; // if not parsable, then make empty
					$(this).val(v);
				});

				fn.item_modal.$modal.on('focus', '.opt_max', function(e){
					var v = parseFloat($(this).val());
					if (isNaN(v)) v = ''; // if not parsable, then make empty
					$(this).val(v);
				});

				fn.item_modal.$modal.on('blur', '.opt_max', function(e){
					var v = parseFloat($(this).val());
					if (isNaN(v)) v = 0; // if not parsable, then make empty
					if (v == '0') v = $phrases.build_label_unlimited;
					$(this).val(v);
				});

				$('#item_avail').on('change', fn.item_modal.avail_changed);


				// fn.item_modal.loc_ms.init();
				fn.item_modal.vflyup.init();

				fn.item_modal.$modal.on('click', '.btn-add-customtime', function(e){
					var $row = $('<div class="row-xs more-times"></div>');
					$row.append($('#open_time_model', fn.item_modal.$modal).html());
					$row.appendTo($(this).parent().siblings('.day_value'));
					fn.item_modal.init_dp($row);
				});

				fn.item_modal.$modal.on('click', '.more-times .btn-del', function(e){
					$(this).parents('.more-times').fadeOut(function(){
						$(this).remove();
						fn.item_modal.inner_monitor();
					});
				});

				$('.time-toggler', fn.item_modal.$modal).togglebox().on('changed', function() {
					var $p = $(this).parents('.row-xs').eq(0);
					if($(this).data('checked')) {
						$('.btn-add-customtime, .day_value > div', $p).show();
					} else {
						$('.btn-add-customtime, .day_value > div', $p).hide();
					}
					fn.item_modal.inner_monitor();
				}).toggleboxSet(true);

				fn.item_modal.init_dp();


				fn.item_modal.$modal.on('change', '#item_tab_1 .choose-all, #item_tab_11 .choose-all', fn.item_modal.chooseAll);
				fn.item_modal.$modal.on('update_state', '#item_tab_1 .choose-all, #item_tab_11 .choose-all', fn.item_modal.updateChooseAllState);
				fn.item_modal.$modal.on('change', '#item_tab_1 input[type="checkbox"].choose, #item_tab_11 input[type="checkbox"].choose', fn.item_modal.choose);

				$('.size-wrap .btn-trash', fn.item_modal.$modal).bind_confirm({
					name: 'remove-size',
					onSubmit: fn.item_modal.remove_size
				});

				$('.opt-wrap .btn-trash', fn.item_modal.$modal).bind_confirm({
					name: 'remove-option',
					onSubmit: fn.item_modal.remove_option
				});

				// fn.item_modal.$modal.on('click', '#item_tab_1 .btn-trash', fn.item_modal.remove_customs);

				fn.item_modal.$modal.on('click', '#btn_add_size', fn.item_modal.add_new_size);
				fn.item_modal.$modal.on('click', '#btn_add_option', fn.item_modal.add_new_option);

				fn.item_modal.$modal.find('ul.size-list').sortable({
					items: '.item_size',
					revert: false,
					opacity: 0.5,
					helper: 'clone',
					handle: '.handle-drag',
					axis: 'y',
					start: function(e, ui) {
						$(ui.item).parent().sortable("refreshPositions");
					},
					stop: function() {
						fn.item_modal.inner_monitor();
					}
				});

				fn.item_modal.$modal.find('ul.option-list').sortable({
					items: '.item_size',
					revert: false,
					opacity: 0.5,
					helper: 'clone',
					handle: '.handle-drag',
					axis: 'y',
					start: function(e, ui) {
						$(ui.item).parent().sortable("refreshPositions");
					},
					stop: function() {
						fn.item_modal.inner_monitor();
					}
				});

				fn.item_modal.$modal.on('change keyup focus blur', 'input,select,textarea', fn.item_modal.inner_monitor);

				fn.item_modal.opt.init();
				
				// round price part
				$('#item_price', fn.item_modal.$modal).focusout(function(){
					fn.item_modal.set_opt_price();
				});
				
				// Round option price
				$(fn.item_modal.$modal).on('focusout', '.opt_price', function(){
					$opt_price = $(this).val(); 
					if ( $.inArray(fn.payment.current_currency_value, fn.non_decimal_currency) !== -1 ) {
						$(this).val(Math.round($opt_price));
					} else {
						$(this).val($opt_price);
					}
				});
				
				// Round size price
				$(fn.item_modal.$modal).on('focusout', '.size_price', function(){
					$size_price = $(this).val(); 
					if ( $.inArray(fn.payment.current_currency_value, fn.non_decimal_currency) !== -1 ) {
						$(this).val(Math.round($size_price));
					} else {
						$(this).val($size_price);
					}
				});
				fn.item_modal.set_opt_price();
				$('#item_img_url', fn.item_modal.$modal).on('blur', fn.item_modal.check_protocol);
			},

			set_opt_price: function() {
				$item_price = $('#item_price',  fn.item_modal.$modal).val();


				if ( $.inArray(fn.payment.current_currency_value, fn.non_decimal_currency) !== -1 ) {
					fn.item_modal.item_price = Math.round($item_price);
				} else {
					fn.item_modal.item_price = $item_price;
				} 
								   
				$('#item_price', fn.item_modal.$modal).val(fn.item_modal.item_price);	
			},
			
			init_dp: function($wrapper) {

				if (!$wrapper) $wrapper = fn.item_modal.$modal;
				var timeFormat = 'HH:mm';
				if ( isLocationUS == '1' ) {
					timeFormat = 'hh:mm A';
				}
				$('div.opentime-from', $wrapper).each(function(i, o){

					if($(o).data("DateTimePicker")) {
						$(o).data("DateTimePicker").destroy();
					}
					
					$(o).datetimepicker({
						'format': timeFormat,
						'useCurrent': 'hour', //Important! See issue #1075
						'widgetPositioning': {
							'horizontal': 'right'
						}
					});

					$(o).on("dp.change", function(e){
						if (e.date == null) return;
						var $p = $(this).parents('.row-xs').eq(0);
						var $to = $('.opentime-to', $p).eq(0);

						var to_time = $to.data('DateTimePicker').date();
						if ((to_time == null) || (to_time < e.date)) {
							$to.data('DateTimePicker').date(e.date)
						}
					});

				});


				$('div.opentime-to', $wrapper).each(function(i, o){

					if($(o).data("DateTimePicker")) {
						$(o).data("DateTimePicker").destroy();
					}

					$(o).datetimepicker({
						'format': timeFormat,
						'useCurrent': 'hour', //Important! See issue #1075
						'widgetPositioning': {
							'horizontal': 'right'
						}

					});
					$(o).on("dp.change", function(e){
						if (e.date == null) return;
						var $p = $(this).parents('.row-xs').eq(0);
						var $from = $('.opentime-from', $p).eq(0);

						var from_time = $from.data('DateTimePicker').date();
						if ((from_time == null) || (from_time > e.date)) {
							$from.data('DateTimePicker').date(e.date)
						}
					});
				});
			},

			clear_dp: function($wrapper) {
				if (!$wrapper) $wrapper = fn.item_modal.$modal;

				$('div.opentime-from', $wrapper).each(function(i, o){
					if ($(o).data("DateTimePicker")) {
						$(o).data("DateTimePicker").clear();
					}
				});

				$('div.opentime-to', $wrapper).each(function(i, o){
					if ($(o).data("DateTimePicker")) {
						$(o).data("DateTimePicker").clear();
					}
				});
			},

			switchEditType: function (isAdd) {
				var dataLabel = isAdd ? 'data-add-label' : 'data-edit-label';
				fn.item_modal.$dlg_title.html(fn.item_modal.$dlg_title.attr(dataLabel));
				fn.item_modal.$btn_save.html(fn.item_modal.$btn_save.attr(dataLabel));
			},

			remove_msg: function(e) {
				$('#item_name', fn.item_modal.$modal).siblings('.msg').remove();
				$('#item_price', fn.item_modal.$modal).siblings('.msg').remove();
				$('#item_img_url', fn.item_modal.$modal).siblings('.msg').remove();
				
				if (fn.opts.data.is_for_cedar == '1') {
					$('.opt_type_name', fn.item_modal.$modal).siblings('.msg').remove();	
				}
			},

			is_valid: function() {

				if (!fn.is_init_done) return true;

				var is_valid = true;

				fn.item_modal.remove_msg();

				var nv = $('#item_name', fn.item_modal.$modal).val(),
				    pv = $('#item_price', fn.item_modal.$modal).val(),
				    uv = $('#item_img_url', fn.item_modal.$modal).val();

				// if (nv == '') {
				// 	$('#item_name', fn.item_modal.$modal).parent().append('<div class="msg right error">' + $phrases.build_label_input_value + '</div>');
				// }
				// if (pv == '') {
				// 	$('#item_price', fn.item_modal.$modal).parent().append('<div class="msg right error">' + $phrases.build_label_input_value + '</div>');
				// }
				if (isNaN(pv) || (parseFloat(pv) < 0)) {
					$('#item_price', fn.item_modal.$modal).parent().append('<div class="msg right error">' + $phrases.build_label_invalid_value + '</div>');
					is_valid = false;
				}
				if (uv != '' && !(isValidURL(uv) || isValidURL('http://' + uv))) {
					$('#item_img_url', fn.item_modal.$modal).parent().append('<div class="msg right error">' + $phrases.build_modal_url_invalid + '</div>');
					// is_valid = false;
				}

				if (fn.opts.data.is_for_cedar == '1') {
					$('li.type .required-mark', fn.item_modal.opt.$list).remove();
					$.each(fn.item_modal.opt.$list.find('li.type'), function(i, o){
						var opt_count = 0;
						$.each($('li.item', $(o)), function(ii, oo){
							if (($('.opt_value', $(oo)).val().trim() == '') || ($('.opt_price', $(oo)).val() == '0' || isValidNumber($('.opt_price', $(oo)).val()) == null)) return true;
							opt_count = opt_count + 1;
						});

						if (opt_count > 0) {
							$('.title .input-group-addon', $(o)).append('<span class="required-mark">*</span>');
						}

						if ((opt_count > 0) && ($('.opt_type_name', $(o)).val().trim() == '')) {
							// $('.opt_type_name', $(o)).parent().append('<div class="msg right error">' + $phrases.build_label_invalid_value + '</div>');
							// $('.opt_type_name', $(o)).after('<div class="msg right error">' + $phrases.build_label_input_value + '</div>');
							is_valid = false;
						}

					});
				}

				return is_valid;
			},

			check_protocol: function() {
				var pv = $('#item_img_url', fn.item_modal.$modal).val().trim();
				var invalid = !(isValidURL(pv) || isValidURL('http://' + pv));

				if (!invalid && (!/^(ht)tps?:\/\//i.test(pv))) {
					$('#item_img_url', fn.item_modal.$modal).val('http://' + pv);
				}

				fn.item_modal.inner_monitor();
			},

			inner_monitor: function() {

				// if (!fn.is_init_done) return;
				if (fn.item_modal.currentEditId == null) return;

				var is_filled = true;
				if (($('#item_cat', fn.item_modal.$modal).val() == null) || ($('#item_cat', fn.item_modal.$modal).val() == '')) is_filled = false;
				if (($('#item_name', fn.item_modal.$modal).val() == null) || ($('#item_name', fn.item_modal.$modal).val() == '')) is_filled = false;
				if (($('#item_price', fn.item_modal.$modal).val() == null) || ($('#item_price', fn.item_modal.$modal).val() == '')) is_filled = false;

				// Now lets check for modal change
				var item = {};
				if (fn.item_modal.currentEditId === false) {
					item = fn.item_modal.get_empty();
				} else {
					item = fn.menu.itemData[fn.item_modal.currentEditCatId]['items'][fn.item_modal.currentEditId]
				}

				var new_item = fn.item_modal.inputData();
				var is_same = deepCompare(item, new_item);

				var is_valid = fn.item_modal.is_valid();

				if (is_filled && is_valid && !is_same) {
					fn.item_modal.$btn_save.removeAttr('disabled');
				} else {
					fn.item_modal.$btn_save.attr('disabled', true);
				}

			},

			avail_changed: function(e) {
				if ($('#item_avail', fn.item_modal.$modal).val() == '2') {
					$('.ots', fn.item_modal.$modal).slideDown();
				} else {
					$('.ots', fn.item_modal.$modal).slideUp();
				}
			},

			get_empty: function() {

				var cat_id = false;

				if ($('li.active', fn.menu.$list).length > 0) {
					cat_id = $('li.active', fn.menu.$list).eq(0).attr('data-id');
				} else {
					for (var key = 0; key < fn.menu.itemData.length; key++) {
						if (fn.menu.itemData[key] != undefined) {
							cat_id = key;
							break;
						}
					}
				}

				var locs = jQuery.extend(true, {}, fn.loc.locData);
				var all_locs = [];

				$.each(locs, function(i, o){
					all_locs.push(i);
				});

				return {
					'menu_id': cat_id,
					'item_name': '',
					'description': '',
					'price': '0.00',
					'is_available': '1',
					'tax_exempted': '0',
					// 'locations': jQuery.extend(true, [], all_locs),
					'locations': [],
					'id': '0',
					'ref_id': cat_id?fn.menu.itemData[cat_id].item_maxNo:0,
					'seq': 0,

					'thumb_id': '',
					'thumb_filename': '',
					'thumb_link': '',
					'thumb_url': '',

					'ots': [false, false, false, false, false, false, false],
					'opt': [],
					'size': [],
				}
			},

			edit: function() {

				fn.item_modal.switchEditType((fn.item_modal.currentEditId === false));
				fn.item_modal.clear_dp();
				// ---------------------------------------------------------------------
				// Set Data
				// ---------------------------------------------------------------------
				var item = {};
				if(fn.item_modal.currentEditId === false) {
					item = fn.item_modal.get_empty();
					if(item.menu_id === false) {
						notify.error($phrases.build_desc_no_menu_existing, 'center', 3000);
						$('#btn_add_category', fn.menu.$wrap).trigger('click');
						return;
					}
				} else {
					item = jQuery.extend(true, {}, fn.menu.itemData[fn.item_modal.currentEditCatId]['items'][fn.item_modal.currentEditId]);
				}

				// ---------------------------------------------------------------------
				// Init Components
				// ---------------------------------------------------------------------

				fn.item_modal.loc_ms.init();
				// fn.item_modal.loc_ms.rebuild();
				// fn.item_modal.loc_ms.clear();
				

				$('#item_cat', fn.item_modal.$modal).html('');
				for (var k = 0; k < fn.menu.itemData.length; k++) {
					$('#item_cat', fn.item_modal.$modal).append('<option value="' + k + '">' + fn.menu.itemData[k]['label'] + '</option>');
				}
				// $('#item_cat', fn.item_modal.$modal).select2('rebuild');



				// ---------------------------------------------------------------------
				// Let's fill up the dialog now
				// ---------------------------------------------------------------------
				$('#item_name', fn.item_modal.$modal).val(item.item_name);
				$('#item_cat', fn.item_modal.$modal).val(item.menu_id).trigger('change');
				$('#item_desc', fn.item_modal.$modal).val(item.description);
				$('#item_price', fn.item_modal.$modal).val(item.price);

				$('#item_img', fn.item_modal.$modal).val(item.thumb_id);
				$('#item_img_filename', fn.item_modal.$modal).val(item.thumb_filename);
				$('#item_img_url', fn.item_modal.$modal).val(item.thumb_url);
				$('#item_currency_label', fn.item_modal.$modal).html(fn.payment.get_current_currency());

				$('.tax-out-toggler', fn.item_modal.$modal).toggleboxSet(item.tax_exempted=='1');

				$('#item_avail', fn.item_modal.$modal).val(item.is_available).trigger('change');

				fn.item_modal.loc_ms.apply(item);

				// ---------------------------------------------------------------------
				// Load open time settings
				// ---------------------------------------------------------------------
				var ind = 0;
				var kv = '';

				$('.item-opentime-set .more-times', fn.item_modal.$modal).remove();

				for (var kv = 0; kv < item.ots.length; kv++) {

					var $p = $('.item-opentime-set > .row-' + ind, fn.item_modal.$modal);
					$p.attr('data-id', '0');
					if (item.ots[kv] === false) {
						item.ots[kv] = {
							'id': '0',
							'open_time': "" + 7*60,
							'close_time': "" + 17*60,
							'more_time':[],
							'is_active': '1'
						};
					}

					if (item.ots[kv]) {

						$p.attr('data-id', item.ots[kv]['id']);

						$('.opentime-from', $p).data("DateTimePicker").date(convert_mins(item.ots[kv]['open_time']));
						$('.opentime-to', $p).data("DateTimePicker").date(convert_mins(item.ots[kv]['close_time']));

						for (var i=0; i<item.ots[kv]['more_time'].length; i++) {
							var $row = $('<div class="row-xs more-times"></div>');
							$row.append($('#open_time_model', fn.item_modal.$modal).html());
							$row.appendTo($('.day_value', $p));
							fn.item_modal.init_dp($row);

							$('div.opentime-from', $row).data("DateTimePicker").date(convert_mins(item.ots[kv]['more_time'][i][0]));
							$('div.opentime-to', $row).data("DateTimePicker").date(convert_mins(item.ots[kv]['more_time'][i][1]));
						}

						if ((item.ots[kv]['open_time'] == item.ots[kv]['close_time']) || (item.ots[kv]['is_active'] == '0')) {
							$('.time-toggler', $p).toggleboxSet(false).trigger('changed');
						} else {
							$('.time-toggler', $p).toggleboxSet(true).trigger('changed');
						}
						
					}

					ind = ind + 1;
				}

				// ---------------------------------------------------------------------
				// Load option and sizes
				// ---------------------------------------------------------------------
				$('#size_list', fn.item_modal.$modal).html('');

				if (fn.opts.data.is_for_cedar == '1') {
					fn.item_modal.opt.build(item);
				} else {
					$('#option_list', fn.item_modal.$modal).html('');
					for (var k = 0; k < item.opt.length; k++) {
						fn.item_modal.render_option(item.opt[k]);
					}	
				}
				
				for (var i=item.opt.length; i<3; i++) {
					fn.item_modal.render_option({id: '0', option_name: '', option_charges: '', is_shown: '1'});
				}


				for (var k = 0; k < item.size.length; k++) {
					fn.item_modal.render_size(item.size[k]);
				}
				for (var i=item.size.length; i<3; i++) {
					fn.item_modal.render_size({id: '0', size: '', price: ''});
				}


				$('.nav-pills > li > a', fn.item_modal.$modal).eq(0).trigger('click');
				fn.opts.$wrap.trigger('onUpdateFlyupAgent');
				fn.item_modal.$modal.modal('show');
				fn.item_modal.inner_monitor();
			},

			inputData: function() {

				var item = fn.item_modal.get_empty();
				if (fn.item_modal.currentEditId !== false) {
					item = jQuery.extend(true, {}, fn.menu.itemData[fn.item_modal.currentEditCatId]['items'][fn.item_modal.currentEditId]);
				}

				item.item_name = $('#item_name', fn.item_modal.$modal).val();
				// item.menu_id = parseInt($('#item_cat', fn.item_modal.$modal).val());
				item.menu_id = $('#item_cat', fn.item_modal.$modal).val();
				// item.description = plugin.fixRedactorTable($('#item_desc', fn.item_modal.$modal).val());
				item.description = $('#item_desc', fn.item_modal.$modal).val();
				item.price = $('#item_price', fn.item_modal.$modal).val();

				item.thumb_id = $('#item_img', fn.item_modal.$modal).val();
				item.thumb_filename = $('#item_img_filename', fn.item_modal.$modal).val();
				item.thumb_url = $('#item_img_url', fn.item_modal.$modal).val();
				item.tax_exempted = $('.tax-out-toggler', fn.item_modal.$modal).data('checked')?'1':'0';
				item.is_available = $('#item_avail', fn.item_modal.$modal).val();

				item['locations'] = [];
				$('#item_locs option:selected').each(function(i, o){
					item['locations'].push(parseInt($(o).attr('value')));
				});
				// var locations = [];
				// $('#item_locs option').each(function(i, o) {
				// 	locations.push($(o).attr('value'));
				// });
				// var item_locs = $('#item_locs', fn.item_modal.$modal).val();
				// item['locations'] = item_locs != null ? item_locs : locations;
				
				// item['locations'].sort();

				item['ots'] = []; // Let's initialize open time
				$('.item-opentime-set>.row-xs', fn.item_modal.$modal).each(function(i, o){
					item['ots'][i] = {
						'id': $(o).attr('data-id'),
						'open_time': "" + convert_mins($('input.opentime-from', $(o)).val(), true),
						'close_time': "" + convert_mins($('input.opentime-to', $(o)).val(), true, $('.time-toggler', $(o)).data('checked')),
						'more_time':[],
						'is_active': $('.time-toggler', $(o)).data('checked')?'1':'0'
					};

					$('.more-times', $(o)).each(function(j, p){
						item['ots'][i]['more_time'].push([
							"" + convert_mins($('input.opentime-from', $(p)).val(), true),
							"" + convert_mins($('input.opentime-to', $(p)).val(), true, true)
						]);
					});

					/*
					if(!$('.time-toggler', $(o)).data('checked')) {
						item['ots'][i]['open_time'] = "" + 0;
						item['ots'][i]['close_time'] = "" + 0;
					} else {
						
					}
					*/
				});

				item['opt'] = []; // Let's initialize option
				if (fn.opts.data.is_for_cedar == '1') {
					item['opt'] = fn.item_modal.opt.get_data();
				} else {

					$('#option_list li', fn.item_modal.$modal).each(function(i, o){
						if (($('.opt_value', $(this)).val().trim() != '') || ($('.opt_price', $(this)).val().trim() != '')) {
							item['opt'].push({
								'id': $(this).attr('data-id'),
								'option_name': $('.opt_value', $(this)).val().trim(),
								'option_charges': $('.opt_price', $(this)).val().trim(),
								'is_shown': $('.togglebox', $(this)).data('checked')?'1':'0',
								'seq': 0
							});
						}
					});

					for (var i=0; i<item['opt'].length; i++) {
						item['opt'][i]['seq'] = item['opt'].length - i;
					}
						
				}
			


				item['size'] = []; // Let's initialize size
				$('#size_list li', fn.item_modal.$modal).each(function(i, o){
					if (($('.size_value', $(this)).val().trim() != '') || ($('.size_price', $(this)).val().trim() != '')) {
						item['size'].push({
							'id': $(this).attr('data-id'),
							'size': $('.size_value', $(this)).val().trim(),
							'price': $('.size_price', $(this)).val().trim(),
							'seq': 0
						});
					}
				});

				for (var i=0; i<item['size'].length; i++) {
					item['size'][i]['seq'] = item['size'].length - i;
				}

				return item;
			},

			save: function() {
				fn.item_modal.check_protocol();

				var item = fn.item_modal.inputData();

				if (fn.item_modal.currentEditId === false) {
					item.ref_id = fn.menu.itemData[item['menu_id']]['item_maxNo'];
					fn.menu.itemData[item['menu_id']]['items'][item.ref_id] = item;
					fn.menu.itemData[item['menu_id']]['item_maxNo'] = fn.menu.itemData[item['menu_id']]['item_maxNo'] + 1;
					fn.menu.render_item(item);
					
					fn.menu.update_cat_item_count(item['menu_id']);
					fn.menu.update_order4item(item['menu_id']);
				} else {
					// Must consider if cat is changed ...
					if (fn.item_modal.currentEditCatId != item.menu_id) {
						delete fn.menu.itemData[fn.item_modal.currentEditCatId]['items'][fn.item_modal.currentEditId];
						// $('#item_' + item.ref_id, fn.menu.$list).remove();
						$('#item_' + fn.item_modal.currentEditCatId + '_' + fn.item_modal.currentEditId, fn.menu.$list).remove();
						fn.menu.update_cat_item_count(fn.item_modal.currentEditCatId);
						fn.menu.update_order4item(fn.item_modal.currentEditCatId);

						item.ref_id = fn.menu.itemData[item['menu_id']]['item_maxNo'];
						fn.menu.itemData[item['menu_id']]['items'][item.ref_id] = item;
						fn.menu.itemData[item['menu_id']]['item_maxNo'] = fn.menu.itemData[item['menu_id']]['item_maxNo'] + 1;
						fn.menu.render_item(item);
						fn.menu.update_cat_item_count(item.menu_id);
						fn.menu.update_order4item(item.menu_id);
					} else {
						fn.menu.itemData[fn.item_modal.currentEditCatId]['items'][fn.item_modal.currentEditId] = item;
						fn.menu.update_item_ui(fn.item_modal.currentEditCatId, fn.item_modal.currentEditId, item);
					}
				}

				fn.item_modal.$modal.modal('hide');
				fn.do_monitor();
			},


			render_size: function (item) {

				var $li = $('<li class="item_size" data-id="' + item.id + '">');

				$li.append('<input data-val-skip="true" class="choose" type="checkbox" />');
				$li.append('<i class="handle-drag fa fa-arrows"></i>');

				// $li.append('<label>' + $phrases.build_label_size_name + '</label><span class="size"><div class="input-group"><input type="text" class="size_value form-control" value="' + escapeHtml(item.size) + '" /><span class="input-group-addon">' + $phrases.build_label_size + '</span></div></span>');
				// $li.append('<label>' + $phrases.build_label_size_price + '</label><span class="price"><div class="input-group"><input type="text" class="size_price form-control" value="' + escapeHtml(item.price) + '" /><span class="input-group-addon">' + $phrases.build_label_price + '(' + fn.payment.get_current_currency() + ')</span></div></span>');

				$li.append('<label>' + $phrases.build_label_size_name + '</label><span class="size"><div class="input-group"><input type="text" class="size_value form-control" value="' + escapeHtml(item.size) + '" /><span class="input-group-addon">' + $phrases.build_label_size + '</span></div></span>');
				$li.append('<label>' + $phrases.build_label_size_price + '</label><span class="price"><div class="input-group"><input type="text" class="size_price form-control" value="' + escapeHtml(item.price) + '" /><span class="input-group-addon">' + $phrases.build_label_price + '(' + fn.payment.get_current_currency() + ')</span></div></span>');

				$li.appendTo($('#size_list', fn.item_modal.$modal));
				plugin.init_uniform($li);
			},

			render_option: function (item) {

				var $li = $('<li class="item_size" data-id="' + item.id + '">');

				$li.append('<input data-val-skip="true" class="choose" type="checkbox" />');
				$li.append('<i class="handle-drag fa fa-arrows"></i>');
				$li.append('<div class="is-active-toggler togglebox ' + ((item.is_shown == "1")?"checked":"") + '"></div>');

				$li.append('<span class="size"><div class="input-group"><input type="text" class="opt_value form-control" value="' + escapeHtml(item.option_name) + '" /><span class="input-group-addon">' + $phrases.build_label_option + '</span></div></span');
				$li.append('<span class="price"><div class="input-group"><input type="text" class="opt_price form-control" value="' + escapeHtml(item.option_charges) + '" /><span class="input-group-addon">' + $phrases.build_label_charges + '(' + fn.payment.get_current_currency() + ')</span></div></span>');

				$li.appendTo($('#option_list', fn.item_modal.$modal));
				plugin.init_uniform($li);
				$li.find('.is-active-toggler').togglebox().on('changed', fn.item_modal.inner_monitor);
			},


			chooseAll: function (e) {
				var $block = $(this).parents('.row-block').eq(0);
				var $choose = $block.find('input[type="checkbox"].choose');
				$choose.prop('checked', $(this).find('input').is(':checked'));
				$.uniform.update($choose);

				$(this).trigger('update_state');
			},

			updateChooseAllState: function (e) {
				var $block = $(this).parents('.row-block').eq(0);
				var $choose = $block.find('input[type="checkbox"].choose');
				var count = $choose.length,
					activeCount = $choose.filter(':checked').length,
					$chooseAllCheck = $block.find('input[type="checkbox"].check-all');

				if ((count > 0) && (activeCount == count)) {
					$chooseAllCheck.prop('checked', true);
					// $(this).find('.checker').toggleClass('partial', count != activeCount);
				} else {
					$chooseAllCheck.prop('checked', false);
				}


				if (activeCount) {
					$block.find('.btn-trash').removeAttr('disabled');
				} else {
					$block.find('.btn-trash').attr('disabled', true);
				}

				$.uniform.update($chooseAllCheck);
			},

			choose: function(e) {
				var $block = $(this).parents('.row-block').eq(0);
				var $chooseAllCheck = $block.find('input[type="checkbox"].check-all');
				$chooseAllCheck.trigger('update_state');
			},

			remove_option: function() {
				fn.item_modal.remove_customs($('.opt-wrap', fn.item_modal.$modal));
			},

			remove_size: function() {
				fn.item_modal.remove_customs($('.size-wrap', fn.item_modal.$modal));
			},

			remove_customs: function($block) {
				var $choose = $block.find('input[type="checkbox"].choose');
					$checked = $choose.filter(':checked');

				// Remove pdfs.
				$.each($checked, function (idx, itm) {
					var $li = $(this).parents('li').eq(0);
					$li.remove();
				});

				// should update check all state & trash button state, why not pushed...
				$block.find('.choose-all').trigger('update_state');
				fn.item_modal.inner_monitor();
			},

			add_new_size: function() {
				fn.item_modal.render_size({id: '0', size: '', price: ''});
				fn.item_modal.inner_monitor();
			},

			add_new_option: function() {
				fn.item_modal.render_option({id: '0', option_name: '', option_charges: '', is_shown: '1'});
				fn.item_modal.inner_monitor();
			}
		},

		map: {
			opts: {
				center: {lat: -33.8666, lng: 151.1958},
				mapTypeControlOptions: {
					style: google.maps.MapTypeControlStyle.DEFAULT
				},
				mapTypeId: google.maps.MapTypeId.ROADMAP,
				zoom: 17
			},
			location: {},
			addressParam: {
			  room: 'long_name',
			  floor: 'long_name',
			  subpremise: 'long_name',
			  premise: 'long_name',
			  street_number: 'long_name',
			  route: 'long_name',
			  locality: 'long_name',
			  administrative_area_level_1: 'long_name',
			  country: 'short_name',
			  postal_code_prefix: 'short_name',
			  postal_code: 'short_name'
			},
			addr1KeyList: ['street_number', 'route'],
			addr2KeyList: ['subpremise', 'premise', 'floor', 'room'],
			map: null,
			searchBox: null,

			$map: null,
			$addr: null,
			$search: null,
			$distType: null,

			info: {
				infoWindow: null,

				init: function () {
					fn.map.info.infowindow = new google.maps.InfoWindow();
				},
				show: function (content, marker) {
					fn.map.info.infowindow.setContent(content);
					fn.map.info.infowindow.open(fn.map.map, marker);
				}
			},
			markers: {
				list: [],
				add: function (marker) {
					fn.map.markers.list.push(marker);
				},
				clear: function () {
					fn.map.markers.setMap(null);
					fn.map.markers.list = [];
				},
				setMap: function (map) {
					$.map(fn.map.markers.list, function (marker) {
						marker.setMap(map);
					});
				}
			},
			latlng: {
				$lat: null,
				$lng: null,

				init: function () {
					fn.map.latlng.$lat = fn.loc_modal.$locationInfo.find('.lat');
					fn.map.latlng.$lng = fn.loc_modal.$locationInfo.find('.lng');

					fn.map.latlng.$lat.on('change', fn.map.latlng.search);
					fn.map.latlng.$lng.on('change', fn.map.latlng.search);
				},

				remove_msg: function(e) {
					fn.map.latlng.$lat.siblings('.msg').remove();
					fn.map.latlng.$lng.siblings('.msg').remove();
				},

				is_valid: function() {

					fn.map.latlng.remove_msg ();

					var isLatValid = isValidLatLng(fn.map.latlng.$lat.val(), 0);
					var isLngValid = isValidLatLng(fn.map.latlng.$lng.val(), 1);

					if (!isLatValid) {
						fn.map.latlng.$lat.parent().append('<div class="msg right error">' + $phrases.build_label_lat_invalid + '</div>');
					}

					if (!isLngValid) {
						fn.map.latlng.$lng.parent().append('<div class="msg right error">' + $phrases.build_label_lng_invalid + '</div>');
					}

					if (isLatValid && isLngValid) {
						fn.loc_modal.$save.removeAttr("disabled");
						return true;
					} else {
						fn.loc_modal.$save.attr("disabled", "true");
						return false;
					}

				},

				set: function (lat, lng) {
					fn.map.latlng.$lat.val(lat);
					fn.map.latlng.$lng.val(lng);
				},
				search: function () {
					var lat = fn.map.latlng.$lat.val().trim(),
						lng = fn.map.latlng.$lng.val().trim(),
						latlng, place;

					if (!lat || !lng) {
						return;
					}

					if (isNaN(lat) || isNaN(lng)) {
						return;
					}

					latlng = new google.maps.LatLng(lat, lng);
					$.post(config.geoServiceUrl, {'lat': lat, 'lng': lng}, function (json) {
						if ( json['status'] == 'OK' ) {
							var resultsData = json.results;
							place = resultsData[0];
							fn.map.map.setCenter(place.geometry.location);

							// Proceed marker.
							fn.map.markers.clear();
							marker = new google.maps.Marker({
								position: place.geometry.location,
								map: fn.map.map,
								title: place.name
							});
							fn.map.markers.add(marker);

							// Poceed info window.
							fn.map.info.show(place.formatted_address, marker);
							fn.map.$addr.val(place.formatted_address);
							fn.map.fill(place);
						} else {
							fn.map.map.setCenter(latlng);

							// Proceed marker.
							fn.map.markers.clear();
							marker = new google.maps.Marker({
								position: latlng,
								map: fn.map.map,
								title: 'Unknown Address'
							});
							fn.map.markers.add(marker);

							// Poceed info window.
							fn.map.info.show('Unknown Address', marker);
							fn.map.$addr.val('');
							fn.map.clear();
						}

						fn.loc_modal.inner_monitor();

					}, 'json');
				}
			},

			init: function () {
				fn.map.$addr = fn.loc_modal.$locationInfo.find('.addr');
				fn.map.$search = fn.loc_modal.$locationInfo.find('.map-search');
				fn.map.$map = fn.loc_modal.$locationInfo.find('.map');
				fn.map.$distType = fn.loc_modal.$locationInfo.find('.dist-type');

				fn.map.map = new google.maps.Map(fn.map.$map.get(0), fn.map.opts);
				fn.map.searchBox = new google.maps.places.SearchBox(fn.map.$addr.get(0));
				fn.map.info.init();
				fn.map.latlng.init();
				fn.map.$distType.select2({minimumResultsForSearch: Infinity});

				google.maps.event.addListener(fn.map.searchBox, 'places_changed', fn.map.searchByAddr);
				fn.map.$search.on('click', function () {
					google.maps.event.trigger(fn.map.$addr.get(0), 'focus');
					google.maps.event.trigger(fn.map.$addr.get(0), 'keydown', {keyCode: 13});
				});

				fn.map.disable();
			},
			init_show: function() {

				fn.map.map = new google.maps.Map(fn.map.$map.get(0), fn.map.opts);

				if (fn.map.$addr.val() != '') {
					fn.map.$search.trigger('click');
				}

			},
			enable: function () {
				fn.loc_modal.$mask.fadeOut('slow', function () {
					fn.loc_modal.$locationInfo.removeClass('masked');
					fn.loc_modal.$locationInfo.find('input').prop('disabled', false);
					if (fn.map.$addr.val() == '') fn.map.$addr.focus();
					fn.map.init_show();
				});
			},
			disable: function () {
				fn.loc_modal.$mask.fadeIn('slow', function () {
					fn.loc_modal.$locationInfo.addClass('masked');
					fn.loc_modal.$locationInfo.find('input').prop('disabled', true);
				});
			},
			fill: function (place) {
				if (place.address_components) {
					fn.map.location['base'] = {
						address_1: '',
						address_2: '',
						formatted_address: place.formatted_address
					};
					$.map(place.address_components, function (address) {
						var addressType = address.types[0];

						if (fn.map.addressParam[addressType]) {
							var val = address[fn.map.addressParam[addressType]];
						  if ($.inArray(addressType, fn.map.addr1KeyList) != -1) {
						  	fn.map.location.base.address_1 += ' ' + val;
						  } else if ($.inArray(addressType, fn.map.addr2KeyList) != -1) {
						  	fn.map.location.base.address_2 += ' ' + val;
						  } else {
						  	fn.map.location.base[addressType] = val;
						  }
						}
					});

					// Update dome elements.
					fn.loc_modal.$addr1.val(fn.map.location.base.address_1.trim());
					fn.loc_modal.$addr2.val(fn.map.location.base.address_2.trim());
					fn.loc_modal.$formatted.val(fn.map.location.base.formatted_address.trim());
					if (fn.map.location.base.country) {
						fn.loc_modal.$country.val(fn.map.location.base.country);
					}
					if (fn.map.location.base.administrative_area_level_1) {
						fn.loc_modal.$state.val(fn.map.location.base.administrative_area_level_1);
					}
					if (fn.map.location.base.locality) {
						fn.loc_modal.$city.val(fn.map.location.base.locality);
					}
					if (fn.map.location.base.postal_code) {
						fn.loc_modal.$zip.val(fn.map.location.base.postal_code);
					}
				}

				// lets find out address top and bottom

				var formatted_address = fn.loc_modal.$formatted.val();
				if (formatted_address.trim() != '') {
					var addrset = split2(formatted_address, ',');
					if (addrset && addrset.length == 2) {
						if (fn.loc_modal.$addr_top.val() == '')
							fn.loc_modal.$addr_top.val(addrset[0]);
						if (fn.loc_modal.$addr_bottom.val() == '')
							fn.loc_modal.$addr_bottom.val(addrset[1]);
					}
				}


			},
			clear: function () {
				fn.map.disable();
				fn.map.location = {};
				fn.loc_modal.$addr1.val('');
				fn.loc_modal.$addr2.val('');
			},
			searchByAddr: function () {
				var places = fn.map.searchBox.getPlaces(),
					place, marker, address;

				if (!places) {
					fn.map.$search.trigger('click');
					return;
				}

				if (!places.length) {
					return;
				}

				place = places[0];
				if (place.formatted_address) {
					if (place.geometry.viewport) {
						fn.map.map.fitBounds(place.geometry.viewport);
					} else {
						fn.map.map.setCenter(place.geometry.location);
						fn.map.map.setZoom(fn.map.opts.zoom);
					}

					// Proceed marker.
					fn.map.markers.clear();
					marker = new google.maps.Marker({
						position: place.geometry.location,
						map: fn.map.map,
						title: place.name
					});
					fn.map.markers.add(marker);

					// Poceed info window.
					fn.map.info.show(place.formatted_address, marker);

					// Proceed lat/lng.
					fn.map.latlng.set(place.geometry.location.lat(), place.geometry.location.lng());
				}

				// now should retrieve place details
				if (place.address_components) {
					fn.map.fill(place);
				} else {
					var request = {
						placeId: place.place_id
					};

					var service = new google.maps.places.PlacesService(fn.map.map);
					service.getDetails(request, function (place, status) {
						if (status == google.maps.places.PlacesServiceStatus.OK) {
							fn.map.fill(place);
						}
					});
				}

				fn.loc_modal.inner_monitor();
			},
		},

		updateContent: function(e, arg) {

			/*
			fn.ordering.$active_store.attr('data-val', fn.ordering.$active_store.val());

			$('.opt_url', fn.opts.$wrap).each(function(i, o){
				$(o).attr('data-val', $(o).val());
			});
			*/

			fn.opts.$wrap.trigger('reload');
		},

		setup_curtain: function(flag) {
			if (flag) {

				if (fn.opts.data.is_new == '1') {

				} else {
					$('#block_switch_to_new_mask', fn.opts.$wrap).css('opacity', 0).show().css('opacity', 0.9);
					$('#block_switch_to_new', fn.opts.$wrap).css('opacity', 0).show().css('opacity', 1);
				}

			} else {
				$('#block_switch_to_new_mask', fn.opts.$wrap).hide();
				$('#block_switch_to_new', fn.opts.$wrap).hide();
			}
		},

		monitor: function (e, data) {
			// custom monitor action
			if (!fn.is_init_done) return false;
			
			// Check if old ordering...
			fn.setup_curtain(true);


			// No data section
			if ($('#loc_list li', fn.loc.$wrap).length > 0) {
				$('#block_loc_no_data').hide();
				$('#block_loc_data').show();
			} else {
				$('#block_loc_data').hide();
				$('#block_loc_no_data').show();
			}

			if ($('#cat_list li', fn.menu.$wrap).length > 0) {
				$('#block_menu_no_data').hide();
				$('#block_menu_data').show();
			} else {
				$('#block_menu_data').hide();
				$('#block_menu_no_data').show();
			}

			// put additional data to be sent to server
			fn.payment.get_tax_data();

			var is_changed = data.result;
			is_changed = is_changed || fn.email2.wysiwyg_getchanged() || fn.email.wysiwyg_getchanged();
			is_changed = is_changed || (!doCompare(fn.opts.data.locs, fn.loc.locData, true, ['dstOffset', 'changed']));
			is_changed = is_changed || (!deepCompare(fn.opts.data.tax, fn.payment.taxData));
			is_changed = is_changed || (!deepCompare(fn.opts.data.gpData, fn.addon.gpData));
			is_changed = is_changed || (!doCompare(fn.opts.data.menuData, fn.menu.itemData, true, ['changed']));

			// check if the url inputs are valid on choice nav
			$.each($('.choice-nav-set a.choice-nav', fn.opts.$wrap), function (i, nav) {
				var item = $(nav).attr('ref');
				if (item == 'custom') return;
				
				var $url = $('#url_' + item, fn.opts.$wrap),
				    uv = $url.val().trim();
				$url.siblings('.msg.error').remove();
				if (uv != '' && !(isValidURL(uv) || isValidURL('http://' + uv))) {
					$url.parent().append('<div class="msg right error">' + $phrases.build_modal_url_invalid + '</div>');
				}
			});

			var possible_save = true;
			if (fn.ordering.$active_store.val() == 'custom') {
				possible_save = fn.loc.is_valid() && possible_save;
				possible_save = fn.service.is_valid() && possible_save;
				possible_save = fn.payment.is_valid() && possible_save;
				possible_save = fn.menu.is_valid() && possible_save;
				if (fn.red2_enable == 1)
				{
					possible_save = fn.email2.is_valid() && possible_save;
				}
				else
				{
					possible_save = fn.email.is_valid() && possible_save;
				}
				// possible_save = fn.email.is_valid() && possible_save;
				possible_save = fn.addon.is_valid() && possible_save;
			}

			return possible_save && is_changed;
		},

		do_monitor: function () {
			fn.opts.$wrap.trigger('monitor');
		},

		check_protocol: function() {
			$.each($('.choice-nav-set a.choice-nav', fn.opts.$wrap), function (i, nav) {
                var item = $(nav).attr('ref');
                if (item != 'custom') {
                    var $url = $('#url_' + item, fn.opts.$wrap),
                        uv = $url.val().trim(),
                        invalid = !(isValidURL(uv) || isValidURL('http://' + uv));
                    $url.siblings('.msg.error').remove();

                    if (!invalid && (!/^(ht)tps?:\/\//i.test(uv))) {
                        $url.val('http://' + uv);
                    }
                }
            });
		},

		customSave: function(e, data) {
			var url_check_result = true;

			fn.check_protocol();
			$.each($('.choice-nav-set a.choice-nav', fn.opts.$wrap), function (i, nav) {
				var item = $(nav).attr('ref');
				if (item != 'custom') {
					var $url = $('#url_' + item, fn.opts.$wrap),
					    uv = $url.val().trim();
					$url.siblings('.msg.error').remove();
					if (uv != '' && !isValidURL(uv)) {
						$('#opt_nav_' + item).trigger('click');
						$url.parent().append('<div class="msg right error">' + $phrases.build_modal_url_invalid + '</div>');
						/*notify.error('Invalid URL', 'center', 5000);*/
						url_check_result = false;
						return false;
					}
				}
			});
			if(!url_check_result) {
				return true;
			}
		},

		beforeSave: function (e, data) {
			// Saving wysiwyg data

			if (fn.red2_enable == 1)
			{
				data['message'] = $('#message', fn.email2.$wrap).val();
				data['admin_message'] = $('#admin_message', fn.email2.$wrap).val();
				data['ordered_items_tpl'] = $('#ordered_items_tpl', fn.email2.$wrap).val();
			}
			else
			{
				data['message'] = $('#message', fn.email.$wrap).val();
				data['admin_message'] = $('#admin_message', fn.email.$wrap).val();
				data['ordered_items_tpl'] = $('#ordered_items_tpl', fn.email.$wrap).val();
			}
			// data['message'] = $('#message', fn.email.$wrap).val();
			// data['admin_message'] = $('#admin_message', fn.email.$wrap).val();
			// data['ordered_items_tpl'] = $('#ordered_items_tpl', fn.email.$wrap).val();
			
			// Saving currernt selection
			fn.saveLastPos();

			// put additional data to be sent to server
			fn.payment.get_tax_data();

			// data['locs'] = jQuery.extend(true, {}, fn.loc.locData);
			data['locs'] = {};
			data['locs']['removed'] = jQuery.extend(true, {}, fn.loc.removedData);
			// data['locs']['changed'] = jQuery.extend(true, {}, fn.loc.getChangedData());
			data['locs']['changed'] = [];
			// $.each(fn.loc.locData, function (idx, itm) {
			// 	if (itm != undefined && itm.changed != undefined && itm.changed) data['locs']['changed'].push(itm);
			// });
			for (i = 0; i < fn.loc.locData.length; i++) {
				if (fn.loc.locData[i] != undefined && fn.loc.locData[i].changed != undefined && fn.loc.locData[i].changed)
					data['locs']['changed'].push(fn.loc.locData[i]);
			}
			data['tax'] = jQuery.extend(true, {}, fn.payment.taxData);
			data['gp'] = jQuery.extend(true, {}, fn.addon.gpData);
			// data['cats'] = jQuery.extend(true, {}, fn.menu.itemData);
			data['cats'] = {};
			data['cats']['removed'] = jQuery.extend(true, {}, fn.menu.removedCats);
			data['cats']['changed'] = [];
			for (i = 0; i < fn.menu.itemData.length; i++) {
				if (fn.menu.itemData[i] == undefined) continue;
				var cat = jQuery.extend(true, {}, fn.menu.itemData[i]);
				cat.items = [];
				for (j = 0; j < fn.menu.itemData[i]['items'].length; j++) {
					var item = jQuery.extend(true, {}, fn.menu.itemData[i]['items'][j]);
					if (item.changed != undefined && item.changed) {
						var locations = [];
						for (k = 0; k < item.locations.length; k++) {
							var loc = item['locations'][k];
							if (fn.loc.locData[loc] != undefined) {
								locations.push(fn.loc.locData[loc].id);
							}
						}
						item.locations = locations;
						cat.items.push(item);
					}
				}
				if ((cat.changed != undefined && cat.changed) || (cat.removedItems != undefined && cat.removedItems.length > 0) || cat.items.length > 0)
					data['cats']['changed'].push(cat);
			}
			/*
			for (ck in data['cats']) {
				// data['cats'][ck]['items'] = jQuery.extend(true, {}, data['cats'][ck]['items']);
				data['cats'][ck]['items'] = [];
				$.each(fn.menu.itemData[ck].items, function (idx, itm) {
					if (itm != undefined && itm.changed != undefined && itm.changed) data['cats'][ck]['items'].push(itm);
				});
			}
			*/
			data['is_for_cedar'] = fn.opts.data.is_for_cedar;

			return data;
		},
		
		saveLastPos: function() {
			if (fn.ordering.$active_store.val() == 'custom') {

				if (fn.red2_enable == 1)
				{
					fn.last_select = {
						'scrollTop': fn.opts.$wrap.parents('.content').eq(0).scrollTop(),
						'subNav': fn.ordering.$custom_nav.find('>li>span>a>i.active').parents('li').index(),
						'innerNav': fn.email2.$wrap.find('.nav-pills>li.active').index()
					};
				}
				else
				{
					fn.last_select = {
						'scrollTop': fn.opts.$wrap.parents('.content').eq(0).scrollTop(),
						'subNav': fn.ordering.$custom_nav.find('>li>span>a>i.active').parents('li').index(),
						'innerNav': fn.email.$wrap.find('.nav-pills>li.active').index()
					};
				}
				// fn.last_select = {
				// 	'scrollTop': fn.opts.$wrap.parents('.content').eq(0).scrollTop(),
				// 	'subNav': fn.ordering.$custom_nav.find('>li>span>a>i.active').parents('li').index(),
				// 	'innerNav': fn.email.$wrap.find('.nav-pills>li.active').index()
				// };
			} else {
				fn.last_select = null;
			}
		},

		loadLastPos: function() {
			if (fn.last_select == null) return;

			var $sub_nav = fn.ordering.$custom_nav.find('>li').eq(fn.last_select.subNav);
			$sub_nav.find('>span>a').trigger('click');
			if ($sub_nav.find('>span>a').attr('href') == '#div_sub_email') {
				if (fn.red2_enable == 1)
				{
					fn.email.$wrap.find('.nav-pills>li').eq(fn.last_select.innerNav).find('>a').trigger('click');
				}
				else
				{
					fn.email.$wrap.find('.nav-pills>li').eq(fn.last_select.innerNav).find('>a').trigger('click');
				}
				// fn.email.$wrap.find('.nav-pills>li').eq(fn.last_select.innerNav).find('>a').trigger('click');
			}
			// fn.opts.$wrap.parents('.content').eq(0).scrollTop(fn.last_select.scrollTop);
			setTimeout(function() {
				fn.opts.$wrap.parents('.content').eq(0).scrollTop(fn.last_select.scrollTop);
				fn.last_select = null; // Need to initialize after load for other ordering tabs.
			}, 500);
		},

		init_data: function () {

			fn.loc.locData = jQuery.extend(true, [], fn.opts.data.locs);
			// fn.loc.locData = jQuery.merge([], fn.opts.data.locs);
			fn.loc.item_maxNo = fn.loc.locData.length;

			fn.payment.taxData = jQuery.extend(true, [], fn.opts.data.tax);
			// fn.payment.taxData = jQuery.merge([], fn.opts.data.tax);
			fn.payment.item_maxNo = fn.payment.taxData.length;

			fn.addon.gpData = jQuery.extend(true, [], fn.opts.data.gpData);
			// fn.addon.gpData = jQuery.merge([], fn.opts.data.gpData);
			fn.addon.item_maxNo = fn.addon.gpData.length;

			fn.menu.itemData = jQuery.extend(true, [], fn.opts.data.menuData);
			// fn.menu.itemData = [];
			// jQuery.merge(fn.menu.itemData, fn.opts.data.menuData);
			fn.menu.item_maxNo = fn.menu.itemData.length;
		},

		flyup_loaded: function () {
			if (fn.cat_modal.vflyup.init_done && fn.item_modal.vflyup.init_done) {
				fn.opts.$wrap.trigger('flyup_loaded');
			}
		},

		/**
		 * Init script.
		 * @return void
		 */
		init: function(opts) {

			fn.red2_enable = $('#red2_account_is_ready').val();

			fn.is_init_done = false;

			fn.opts = opts;

			fn.opts.$wrap.on('customSave', fn.customSave);
			fn.opts.$wrap.on('beforeSave', fn.beforeSave);
			fn.opts.$wrap.on('updateContent', fn.updateContent);
			fn.opts.$wrap.on('monitorBoardForce', fn.monitor);
			fn.opts.$wrap.on('blur', '#url_mycheck, #url_imenu360, #url_olo, #url_eat24, #url_grubhub, #url_seamless, #url_onosys', fn.check_protocol);

			fn.init_data();
			fn.ordering.init();

			$('[data-toggle="tooltip"]', fn.opts.$wrap).tooltip({
				animation: false, 
				trigger: 'manual'
			}).clingTooltip();
			
			fn.ordering.init_submenu();

			fn.loc.init();
			fn.loc_modal.init();
			fn.payment.init();
			fn.service.init();
			
			if (fn.red2_enable == 1)
			{
				fn.email2.init();
			}
			else
			{
				fn.email.init();
			}
			// fn.email.init();
			fn.addon.init();
			fn.gp_modal.init();
			fn.cat_modal.init();
			fn.item_modal.init();
			fn.menu.init();

			fn.setup_curtain(true);
			
			fn.is_init_done = true;
			// fn.loadLastPos();

			// fn.opts.$wrap.trigger('init_load_done');
		}
	};

	return fn;
});