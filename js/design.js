/**
 * design.js
 * 
 * @author Austin L <auslee986@gmail.com>
 * @version 1.0
 */

define(['plugin', 'notify', 'ajax', 'modal', 'greensock', 'flyup', 'cloudslider', 'hire', 'form', 'html5sortable', 'colorpicker', 'rangeslider'], function(biz, nt, ajax, modal, greensock, Flyup, cloudslider, Hire) {

	var fn = {

		pageId: 'design',

		// Common 
		common: {

			skipRender: false, // skip rendering Previewer in Home Screen and Screen Styling section
			$pageBody: null,
			$applause_modal: false,

			cssCallbacks: {
				"home_header": "fn.home.updateHeaderCss",
				"home_bg": "fn.home.updateBackgroundColor",
				"tab_button": "fn.nav.updateTabButtonCss",
				"global_header": "fn.global.updateHeaderCss",
				"global_bg": "fn.global.updateBackgroundColor"
			},

			enableSaveButton: function(enabled) {
				$(".page-header .btn-save").prop("disabled", !enabled);
			},

			/* To Do - CV-2254 */
			onHoverTopSpace: function() {

				$(".top-space", this.$pageBody).on('mouseenter', function(e) {

					if ($(this).find(".nav-type-list").length > 0 || $(this).hasClass("hover-skip")) return;
					if ($(this).find("div.hover-overlay").length == 0) {

						if ($(this).hasClass("nav-shortcuts") && $(".shortcut-row").length == 0) {
							var html = "<div class = 'hover-overlay' style = 'height:90%;'></div>";
						} else {
							var html = "<div class = 'hover-overlay'></div>";
						}

						$(this).prepend(html);

					}

				}).on('mouseleave', function(e) {
					$(this).find("div.hover-overlay").remove();

				});
			},

			updateHasValueSet: function(category) {
				var hasValue = false;
				if (category == "home_slider") {
					var index, item;
					for (index in g_vars.slider.phone.active) {
						item = g_vars.slider.phone.active[index];

						if (typeof item != "undefined" && typeof item.id != "undefined" && item.id != "") {
							hasValue = true;
							break;
						}
					}

				} else {
					var $obj = false;

					switch (category) {
						case "home_header":
							$obj = $("#field_home_header");
							break;
						case "home_bg":
							$obj = $("#field_home_bg_phone");
							break;
						case "shortcut":
							$obj = $("#modal_shortcut #shortcut");
							break;
						case "tab_button":
							$obj = $("#field_tab_button");
							break;
						case "global_header":
							$obj = $("#field_global_header");
							break;
						case "global_bg":
							$obj = $("#field_global_bg_phone");
							break;
					}

					if ($obj && $obj.val() != "" && $obj.val() != "g_no_header" && $obj.val() != "g_" && $obj.val() != g_vars.tab_button.no_image.id) {
						hasValue = true;
					}
				}

				var pickerSelector = "." + category.replace("_", "-") + "-picker";
				var $picker = $(pickerSelector);

				$picker.toggleClass("has_value_set", hasValue);

				$picker.children("i").remove();
				if (hasValue) {
					$picker.append('<i class="iconba icon-green-circle"></i>');
				}
			},

			// CV-472: Design: Using slider list layout buttons text will be always enabled
			toggle_show_text: function(navType, navSubtype) {
				if (navType == "sliding" && navSubtype == "list") {
					$("#item_tab_showtext").hide();
					$("#item_tab_text").show();
					fn.nav.$container.find(".highlight-icon-text").removeClass("highlight-hidden");
				} else {
					$("#item_tab_showtext").show();
					var is_checked = $("input[name=tab_showtext]").prop("checked");
					if (is_checked) {
						$("#item_tab_text").show();
						fn.nav.$container.find(".highlight-icon-text").removeClass("highlight-hidden");
					} else {
						$("#item_tab_text").hide();
						fn.nav.$container.find(".highlight-icon-text").addClass("highlight-hidden");
					}
				}
			},

			init_checkNoheader: function() {
				var real_url;
				var color = $("#global_header_tint").val();
				var $preview = $(".highlight-ss-header-bg");
				var $header = $("#field_global_header");

				if ($header.val() == "g_no_header") {
					real_url = "/global_headers/35.png";
					$preview.find(".overlay").css("background-color", "#" + color).css("opacity", 1);
				}
				$preview.find("img.preview").attr({
					src: real_url
				});

			},

			backup_form_data: function() {
				$("#frm_design").find("input:not(.check-all), textarea, select").each(function() {
					if ($(this).hasClass("chk_row_shortcut")) {
						return true;
					}

					if ($(this).is("input[type=checkbox]")) {
						$(this).data("o_checked", $(this).prop("checked"));
					} else if ($(this).is("input[type=radio]")) {
						$(this).data("o_checked", $(this).prop("checked"));
					} else {
						$(this).data("o_value", $(this).val());
					}
				});


				$(".section").find("div.highlight .inner").each(function() {
					$(this).data("o_src", $(this).css("background-image"));
				});

				// Backup current shortcut data to "shortcuts_backup" and compare with this to check changes
				g_vars.shortcuts_backup = $.extend(true, {}, g_vars.shortcuts);

				fn.home.activeSlidePhoneData = $.extend(true, {}, g_vars.slider.phone.active);
				fn.home.activeSlideTabletData = $.extend(true, {}, g_vars.slider.tablet.active);
				fn.home.activeSlidingMode.phone = g_vars.slider.phone.sliding_mode;
				fn.home.activeSlidingMode.tablet = g_vars.slider.tablet.sliding_mode;
			},

			check_changed: function() {
				var is_changed = false;
				$("#frm_design").find("input:not(.check-all), textarea, select").each(function() {

					if ($(this).hasClass('ignore-change')) {
						return true;
					}

					if ($(this).is("input[type=checkbox]")) {
						if ($(this).hasClass("chk_row_shortcut")) {
							return true;
						}

						var new_status = $(this).prop("checked");
						if ($(this).data("o_checked") != new_status) {
							//console.log(['case1', this]);
							is_changed = true;
							return false;
						}
					} else if ($(this).is("div.highlight .inner")) {
						if ($(this).data("o_src") != $(this).css("background-image")) {
							//console.log(['case2', this]);
							is_changed = true;
							return false;
						}
					} else if ($(this).is("input[type=radio]")) {
						var new_status = $(this).prop("checked");
						if ($(this).data("o_checked") != new_status) {
							//console.log(['case3', this]);
							is_changed = true;
							return false;
						}
					} else {
						if ($(this).data("o_value") != $(this).val()) {
							//console.log(['case4', this]);
							is_changed = true;
							return false;
						}
					}
				});


				// CV-2809 compare slide data, 
				if (!is_changed) {

					// 1. Check Sliding Mode.
					if (fn.home.activeSlidingMode.phone != g_vars.slider.phone.sliding_mode || fn.home.activeSlidingMode.tablet != g_vars.slider.tablet.sliding_mode) {
						is_changed = true;
						return false;
					}

					// 2. Check Slider Details.
					for (index in fn.home.activeSlidePhoneData) {
						orignialItem = fn.home.activeSlidePhoneData[index];
						item = g_vars.slider.phone.active[index];

						if (orignialItem.link_tab.link_tab_id != item.link_tab.link_tab_id || orignialItem.link_tab.link_cat_id != item.link_tab.link_cat_id || orignialItem.id != item.id || orignialItem.link_tab.link_detail_id != item.link_tab.link_detail_id) {
							is_changed = true;
							return false;
						}
					}

					for (index in fn.home.activeSlideTabletData) {
						orignialItem = fn.home.activeSlideTabletData[index];
						item = g_vars.slider.tablet.active[index];

						if (orignialItem.link_tab.link_tab_id != item.link_tab.link_tab_id || orignialItem.link_tab.link_cat_id != item.link_tab.link_cat_id || orignialItem.id != item.id || orignialItem.link_tab.link_detail_id != item.link_tab.link_detail_id) {
							is_changed = true;
							return false;
						}

					}
				}

				// Check shortcut orders
				var is_changed_shortcut = false;

				if (!is_changed) {
					var id;

					var old_ids = {};
					var old_shortcuts = [];
					for (id in g_vars.shortcuts_backup) {
						old_ids[g_vars.shortcuts_backup[id].seq] = g_vars.shortcuts_backup[id].id;
					}

					for (seq in old_ids) {
						id = old_ids[seq];
						old_shortcuts.push(g_vars.shortcuts_backup[id]);
					}

					var new_ids = {};
					var new_shortcuts = [];
					for (id in g_vars.shortcuts) {
						new_ids[g_vars.shortcuts[id].seq] = g_vars.shortcuts[id].id;
					}

					for (seq in new_ids) {
						id = new_ids[seq];
						new_shortcuts.push(g_vars.shortcuts[id]);
					}

					// Compare backup data and current data
					if (old_shortcuts.length != new_shortcuts.length) {
						is_changed = true;
					} else {
						old_shortcuts.forEach(function(old, ix) {
							if (!fn.shortcut.compare(old, new_shortcuts[ix])) {
								if (old.icon.id == "g_no_button" && new_shortcuts[ix].icon.id == "") {
									is_changed = false;
								} else {
									is_changed = true;

									// Cv-2861 
									if (is_changed) {
										is_changed_shortcut = true;
									}
								}

								return false;
							}
						});
					}
				}

				if (is_changed || is_changed_shortcut) {
					$("body").addClass("changed");
					fn.common.enableSaveButton(true);
					$(".design_changed", $("#modal_design_applause")).val("1");
					fn.common.hide_applause_popup();

				} else {
					$("body").removeClass("changed");
					fn.common.enableSaveButton(false);
					$(".design_changed", $("#modal_design_applause")).val("");

				}
			},

			monitor_form: function() {
				$("#frm_design").on("change", "select", function() {
					fn.common.check_changed();

				}).on("change keyup", "input:not(.check-all):not(.shortcut_active), textarea", function() {
					if ($(this).hasClass("chk_row_shortcut")) {
						return;
					}

					fn.common.check_changed();

				});
			},

			auto_scroll: function() {
				var hbarHeight = 0;
				if ($("body").hasClass("has_hbar")) {
					hbarHeight = 36;
				}

				$('.auto-scrolling').each(function() {
					var _this = $(this);
					var objOffset = _this.offset();
					var objTop = objOffset.top;
					var headerHeight = $('.header').outerHeight();
					var pageHeaderHeight = $('.page-header').outerHeight();

					var jSection = _this.closest('.section');
					var sectionOffset = jSection.offset();
					var sectionTop = sectionOffset.top;
					var sectionHeight = jSection.outerHeight();

					var isAdjusted = false;

					if ($(window).width() >= 992) { // Small devices.
						if (sectionTop < hbarHeight + headerHeight + pageHeaderHeight - 42) {
							// Should be scrolled.
							isAdjusted = true;
							var paddingTop = 32;
							var paddingBottom = parseInt(jSection.css("padding-bottom"));
							if (sectionTop + sectionHeight > hbarHeight + headerHeight + pageHeaderHeight + paddingTop + _this.outerHeight() + paddingBottom) {
								_this.css({
									position: "fixed",
									top: (hbarHeight + headerHeight + pageHeaderHeight + paddingTop) + "px"
								});
							} else {
								_this.css({
									position: "absolute",
									top: "inherit",
									bottom: 0
								});
							}
						}
					}

					if (!isAdjusted) {
						_this.removeAttr('style');
					}
				});
			},

			init_colorpickers: function() {

				// Shortcut Color Picker
				biz.init_colorpicker({
					object: $(".design-color-picker"),
					afterChange: function(hsb, hex, rgb, el) {

					},
					afterSubmit: function(hsb, hex, rgb, el) {

					}
				});

				// Navigation Buttons - Tab text color picker
				biz.init_colorpicker({
					object: $(".design-tab-text-color-picker"),
					afterChange: function(hsb, hex, rgb, el) {

						fn.nav.updateTabButtonText(hex);
						fn.nav.updateTabButtonTextForWhite();
					},
					afterSubmit: function(hsb, hex, rgb, el) {

						fn.nav.updateTabButtonText(hex);
						fn.nav.updateTabButtonTextForWhite();
					}
				});

				// Default color pickers
				biz.init_colorpicker({
					object: $(".flyup .color-picker"),
					afterChange: function(hsb, hex, rgb, el) {
						// $(el) = div.color-picker
						var $frm = $(el).closest("form");
						var formName = $frm.data("name");

						if (typeof fn.common.cssCallbacks[formName] !== "undefined") {
							if (!fn.common.skipRender) {
								eval(fn.common.cssCallbacks[formName] + "();");
							}
							fn.common.skipRender = false;
						}

					},
					afterSubmit: function(hsb, hex, rgb, el) {
						// $(el) = div.color-picker
						var $frm = $(el).closest("form");
						var formName = $frm.data("name");

						if (typeof fn.common.cssCallbacks[formName] !== "undefined") {
							if (!fn.common.skipRender) {
								eval(fn.common.cssCallbacks[formName] + "();");
							}
							fn.common.skipRender = false;
						}

					}
				});
			},


			on_save: function() {
				$(".page-header .btn-save").click(function() {
					// Prepare hidden value for filenames
					var extraData = {
						route: "design.save",
						nav: fn.home.$navTypeList.data()
					};

					var $frm = $("#frm_design");
					var fields = [
						//"app_icon",
						"home_header", "home_bg_phone", "home_bg_tablet",
						"tab_button",
						"shortcut",
						"global_header", "global_bg_phone", "global_bg_tablet",
					];

					fields.forEach(function(field) {
						var $field = $frm.find("input[name=" + field + "]");
						var $field_name = $frm.find("input[name=" + field + "_filename]");
						if ($field.length == 0 || $field_name == 0) {
							return true;
						}

						extraData[field + "_filename"] = $field_name.val();
						extraData[field + "_real_url"] = $field.data("realUrl");
					});

					fn.shortcut.$container.find(".shortcut-row").each(function() {
						var $sc = $(this);
						var sc_id = $sc.data("id");

						g_vars.shortcuts[sc_id].seq = $sc.index() + 1;
					});

					extraData["shortcuts"] = g_vars["shortcuts"];
					extraData["slider"] = {
						phone: {
							slides: g_vars.slider.phone.active,
							sliding_mode: g_vars.slider.phone.sliding_mode
						},
						tablet: {
							slides: g_vars.slider.tablet.active,
							sliding_mode: g_vars.slider.tablet.sliding_mode
						},
					};

					fn.common.$pageBody.started();
					fn.common.enableSaveButton(false);

					// Close all visible horizontal flyups
					fn.flyup.closeOtherFlyups();

					$("#frm_design").ajaxSubmit({
						success: function(json) {
							if (!json.success) {
								nt.error(json.msg);
								return;
							}

							// Added By Meng
							window.app_previewer.refresh();

							$("body").removeClass("changed");

							nt.success(json.msg);

							// Reloaded shortcuts
							g_vars.shortcuts = $.extend(true, {}, json.shortcuts);
							fn.common.backup_form_data();

							//CV-2351
							$(".design_saved", $("#modal_design_applause")).val("1");
							$(".design_changed", $("#modal_design_applause")).val("");

							// Replace all temp_id => new_id
							var shortcutData, $newItem;
							for (var temp_id in json.new_shortcut_maps) {
								shortcutData = json.new_shortcut_maps[temp_id];

								if (typeof shortcutData.html !== "undefined") {
									$newItem = $(shortcutData.html);
									var $chk = $newItem.find("input[type=checkbox].shortcut_active");
									$chk.data("o_checked", $chk.prop("checked"));

									$(".shortcut-row-" + temp_id).replaceWith($newItem);

									$newItem.find(".togglebox").togglebox();
									biz.init_uniform($newItem);
								} else {
									console.error("[on_save - success()] HTML is not returned for shortcut_temp_id #" + temp_id);
								}
							}
							fn.shortcut.init_sortable();

							// Home Slider - Update slide data for Library blocks which were selected before Save
							var $flyupSlider = $("#flyup_home_slider");
							var device, seq;
							var $devicePanel, slideList, blockData;
							for (device in json.flyup_seqs) {
								slideList = json.flyup_seqs[device];
								// .phone-only | .tablet-only
								$devicePanel = $flyupSlider.find("." + device + "-only");
								for (seq in slideList) {
									blockData = slideList[seq];
									$devicePanel.find(".slide-" + seq).data({
										filename: blockData["filename"],
										id: blockData["id"],
										url: blockData["url"],
										realUrl: blockData["realUrl"],
										tabtype: blockData["tabtype"]
									});

									var new_data = {
										filename: blockData["filename"],
										id: blockData["id"],
										url: blockData["url"],
										real_url: blockData["realUrl"],
										tabtype: blockData["tabtype"]
									};

									$.extend(g_vars.slider[device].active[6 - seq], new_data);
								}
							}

							// Reload Home Background, Home Slider, Global Background flyup custom images
							var hbg = json.bg_copied.home_bg;
							if (hbg.phone) {
								$("#field_home_bg_phone").data({
									filename: hbg.phone.filename
								}).val(hbg.phone.id);
							}
							if (hbg.tablet) {
								$("#field_home_bg_tablet").data({
									filename: hbg.tablet.filename
								}).val(hbg.tablet.id);
							}

							var gbg = json.bg_copied.global_bg;
							if (gbg.phone) {
								$("#field_global_bg_phone").data({
									filename: gbg.phone.filename
								}).val(gbg.phone.id);
							}
							if (gbg.tablet) {
								$("#field_global_bg_tablet").data({
									filename: gbg.tablet.filename
								}).val(gbg.tablet.id);
							}

							$(".home-bg-picker, .global-bg-picker, .home-slider-picker").each(function() {
								$(this).flyup("reload", "phone");
								$(this).flyup("reload", "tablet");
							});

							// Reset checkboxes in shortcut list
							fn.shortcut.$checkall.prop('checked', false).trigger('change');
							$.uniform.update(fn.shortcut.$checkall);

							setTimeout(function() {
								fn.common.$pageBody.completed();
							}, 100);

						},

						error: function() {
							nt.error(phrases.design_label_failed_unexpected_error);
							fn.common.$pageBody.completed();
							fn.common.enableSaveButton(true);
						},

						url: biz.config.ajaxUrl,
						dataType: 'json',
						data: extraData
					});


				});
			},

			/* Applause Popup : After save and scroll down to bottom of content */
			popup_applause: function() {
				var $elem = $('.content');
				var $modal_img = $(".img-sub-container", fn.common.$applause_modal);
				var $select = $("select");

				$('.content').scroll(function() {

					if ($(".applause_hide", fn.common.$applause_modal).val() == "0" && $(".design_saved", fn.common.$applause_modal).val() == "1" && $(".design_changed", fn.common.$applause_modal).val() == "" && $elem[0].scrollHeight - $elem.scrollTop() == $elem.outerHeight() && $(".select2.active").length < 1) {

						fn.common.$applause_modal.addClass("active");

						$modal_img.slideUp();

						window.app_previewer.collapse();

						if ($("#screen_styling_section").hasClass('scustom')) {
							$(".page-body").animate({
								bottom: fn.common.$applause_modal.height() + 20 + "px"
							}, {
								duration: 'slow',
								easing: 'linear'
							});
						}

						fn.common.$applause_modal.animate({
							bottom: "0px"
						}, {
							duration: 'slow',
							easing: 'linear',

							complete: function() {

								$modal_img.slideDown();
								$(".popup_completed", fn.common.$applause_modal).val("1");
							},

							fail: function() {
								$(".popup_completed", fn.common.$applause_modal).val("0");
							}
						});
					}

				});

			},

			hide_applause_popup: function() {

				var $modal_img = $(".img-sub-container", fn.common.$applause_modal);

				if ($(".popup_completed", fn.common.$applause_modal).val() == "1" && fn.common.$applause_modal.hasClass("active")) {

					fn.common.$applause_modal.removeClass("active");

					$(".page-body").animate({
						bottom: "0px"
					}, {
						duration: 'slow',
						easing: 'linear'
					});
					fn.common.$applause_modal.animate({
						bottom: "-450px"
					}, {
						duration: 'slow',
						easing: 'linear'
					});
					$modal_img.slideUp();

					$(".popup_completed", fn.common.$applause_modal).val("0");

					// Animate Opened Select2 Dropdown
					var $select2_dropdown = false;
					setTimeout(function() {
						$select2_dropdown = $("body").find(".select2-container.select2-container--open").last();

						if ($select2_dropdown.length == 0) return;

						var offset = fn.common.$applause_modal.height() + 20;
						var top = parseInt($select2_dropdown.css("top").split("px")[0]) + offset;
						$select2_dropdown.animate({
							top: top + "px"
						}, {
							duration: 'slow',
							easing: 'linear'
						});

					}, 1);

				}
			},

			bind_hide_applause: function() {
				var $select = $("select");
				var $elements = $(".previewer-devices").add($(".help-info-dropdown button"))
					.add($("#cms_header .navbar-nav li a"))
					.add($(".previewer-devices li a"))
					.add($("#contact_menu_wrapper li a"))
					.add($(".btn-build", fn.common.$applause_modal));

				$select.on("select2:opening", function() {

					fn.common.hide_applause_popup();
				});

				if (fn.common.$applause_modal.hasClass("active")) {

					$("select").each(function() {
						var $dropdown = $(this).data("select2").$dropdown;

					});
				}

				$elements.on("click", function() {
					fn.common.hide_applause_popup();
				});

				// Firefox
				$('.content').bind('DOMMouseScroll', function(e) {
					if (e.originalEvent.detail <= 0) {

						//scroll up
						//Check popup modal anmiation is completed,
						fn.common.hide_applause_popup();
					}

				});

				// Chrome,IE, Opera, Safari
				$('.content').bind('mousewheel', function(e) {
					if (e.originalEvent.wheelDelta >= 0) {
						//scroll up
						//Check popup modal anmiation is completed,
						fn.common.hide_applause_popup();
					}

				});

				//When click Home Screen Tip, we should remove the bottom of page-body, the bottom was added when showing applause.
				$(".glow-nav li[data-target=#home_screen_section]").on("click", function() {
					$(".page-body").animate({
						bottom: "0px"
					}, {
						duration: 'slow',
						easing: 'linear'
					});
				});

				/* Open Select2 */
				var $select = $("select");

				$select.on("select2:opening", function() {
					$(this).addClass("active");
				}).on("select2:closing", function() {
					$(this).removeClass("active");
				});

				/* Click No Thank you Link */

				fn.common.$applause_modal.on("click", ".btn-no-thanks", function() {
					fn.common.hide_applause_popup();
					fn.common.$applause_modal.find(".applause_hide").val(1);
					
					ajax.post("design.update_applause_status", {
	                    app_id: g_app_id,
	                    },
	                    function(json) {
	                        if (!json.success) {
	                            nt.error(json.msg);
	                            return;
	                        }
	                	});
					
				});
			},
			/* ** Applause Popup - End ** */

			/* name: home_bg | global_bg | home_slider */
			reload_bg_flyup: function(name, data) {
				var selectors = {
					home_bg: '.home-bg-picker',
					home_slider: '.home-slider-picker',
					global_bg: '.global-bg-picker'
				};

				var $picker = $(selectors[name]);
				var jflyup = $picker.data("jflyup");

				$.each(jflyup.config.list[data.device].custom, function(ele, ix) {
					if (ele.id == data.id) {
						delete jflyup.config.list[data.device].custom.splice(ix, 1);
					}
				});

				if (name == "home_slider") {
					jflyup.slideUnmark(data.device, data.id);
				}

				jflyup.reload(data.device);

			},
			/* fn.common.reload_bg_flyup() */

			init: function() {

				fn.common.$pageBody = $(".page-body.design");
				this.$applause_modal = $("#modal_design_applause", $(".content"));

				// Init toggle checkbox elements
				$('.togglebox').togglebox();

				// Init select2
				biz.init_selectbox({
					selector: ".select2"
				});

				// Init Highlight without custom options
				$('.highlight-toggler').highlight();

				// Color pickers
				this.init_colorpickers();

				// Rangesliders
				biz.init_rangeslider({
					object: $(".flyup .range-slider")
				});

				// Save action
				this.on_save();

				// Hover Top Space
				this.onHoverTopSpace();

				// Applause Modal when scroll down at the bottom
				if ( !is_partner ) {
					this.popup_applause();
					this.bind_hide_applause();
				}

				// Auto-scroll preview box
				$('.content').on('scroll', function(e) {
					if ($(".select2-dropdown").length > 0) {
						return;
					}

					var _this = $(this);
					var oldScrollTop = _this.data("prevScrollTop");
					var newScrollTop = _this.scrollTop();

					if (oldScrollTop != newScrollTop) {
						fn.common.auto_scroll();
						_this.data("prevScrollTop", newScrollTop);
					}
				}).on("click", function() {}).data({
					prevScrollTop: 0
				});

				$(window).on('resize', fn.common.auto_scroll);

				$(window).on("beforeunload", function() {
					// If this is not local site
					if (/^lc\.dev\./i.test(window.location.host) == false) {
						if ($("body").hasClass("changed")) {
							return phrases.design_label_failed_save_data;
						}
					}

					$(".flyup.in:not(.vflyup)").find(".btn-flyup-cancel").click();
				});

				$(window).on("unload", function(e) {
					return false;
				})

			},

			afterInit: function() {

				// Reset / Update ipad_bg_set_mode
				$(".flyup-cat-bg").on("show.flyup", function(event) {
					var ipad_bg_set_mode = parseInt($("input[name=ipad_bg_set_mode]").val()); // 1 or 0	
					$("input[name=flyup_ipad_bg_set_mode]", this).data("prev", ipad_bg_set_mode);
					$(".toggglebox-ipad-bg-set-mode", this).toggleboxSet(ipad_bg_set_mode);

				}).on("saved.flyup", function(event) {
					var ipad_bg_set_mode = ($("input[name=flyup_ipad_bg_set_mode]", this).prop("checked") ? 1 : 0);

					$("#ipad_bg_set_mode").val(ipad_bg_set_mode);

					if ($("#ipad_bg_set_mode").val() == '1') {

						// Set tablet setting with phone setting, For Home Bg, Global Bg.
						var home_img_val = fn.home.$ele.bg.phone.val();
						var global_img_val = fn.global.$ele.bg.phone.val();

						var home_img_name = $("input[name=home_bg_phone_filename]").val();
						var global_img_name = $("input[name=global_bg_phone_filename]").val();

						var orig_home_bg = $(".hl-home-bg").css("background-image");
						var home_bg = orig_home_bg.replace('url("', "").replace('")', "").replace("width=144", "width=192");

						var orig_global_bg = $(".highlight-ss-screen-bg .inner").css("background-image");
						var global_bg = orig_global_bg.replace('url("', "").replace('")', "").replace("width=144", "width=192");

						fn.home.$ele.bg.tablet.attr("data-url", home_bg);
						fn.home.$ele.bg.tablet.attr("data-real-url", home_bg);
						fn.global.$ele.bg.tablet.attr("data-url", global_bg);
						fn.global.$ele.bg.tablet.attr("data-real-url", global_bg);
					}

					fn.common.check_changed();
				});

				// Check for Save & Cancel
				$(".flyup").on("hidden.flyup", function() {
					var _this = Flyup.prototype.getFlyup(this);

					if (_this.config.category != "bg") {
						fn.common.updateHasValueSet(_this.config.name);
					} else {

						// CV-2862, Should update all bg flyup
						['home_bg', 'global_bg', 'home_slider'].forEach(function(picker) {
							fn.common.updateHasValueSet(picker);
						});
					}

				}).each(function() {
					var _this = Flyup.prototype.getFlyup(this);
					fn.common.updateHasValueSet(_this.config.name);

				});

				fn.common.init_checkNoheader();
			}
		},

		/* Flyup */
		flyup: {

			closeOtherFlyups: function($flyup) {
				var $restFlyups = $('.flyup.in:not(.vflyup)');
				if (typeof $flyup != "undefined" && $flyup.length > 0) {
					$restFlyups = $restFlyups.not($flyup);
				}

				// Get the candidate flyup to the top.
				// Check if there are another flyups opened.
				if ($restFlyups.length) {
					$restFlyups.find('.flyup-header .btn-flyup-cancel').trigger('click');
				}
			},

			bindCancelBtn: function($flyup, callback) {
				$flyup.find('.btn-cancel').on('click', function() {
					fn.flyup.cancel($flyup, callback);
				});
			},

			cancel: function($flyup, callback) {
				$flyup.slideUp('slow', function() {
					if (callback) {
						callback();
					}
				});
			},
		},

		// Home Screen
		home: {

			$ele: {
				header: $("input[name=home_header]"),
				bg: {
					phone: $("input[name=home_bg_phone]"),
					tablet: $("input[name=home_bg_tablet]")
				}
			},

			activeSlidePhoneData: false,

			activeSlideTabletData: false,

			activeSlidingMode: {
				phone: false,
				tablet: false,
			},

			// Slider Phone - will be used to get real_url of active phone slide when it's opened.
			sliderPhone: [],

			hasSlider: false,

			$container: false,

			// Preview element (jQuery object)
			$preview: false,

			// Array of width and height of each element in preview
			preview: {
				iosStatusBarHeight: 14
			},

			updateAddiButtonCss: function(button_text_color, button_bg_color) {
				var $style = $("style#css_addi_btn_color");
				var html = '.setting-preview .highlight.highlight-addi-btn {' + 'color: #' + button_text_color + ';' + 'background-color: #' + button_bg_color + ';' + '}';

				$style.html(html);
			},

			init_check_radios: function() {
				biz.init_uniform(fn.home.$container);

				biz.init_check_radios({
					container: fn.home.$container,
					name: "side_edges_position",
					onChange: function(navSubtype) {
						fn.home.$preview.removeClass("left right").addClass(navSubtype);
						fn.home.$navTypeList.data({
							navSubtype: navSubtype
						});

						fn.home.draw_preview(true);
						$("#frm_design").removeClass("edges_left edges_right").addClass("edges_" + navSubtype);
					}
				});

				biz.init_check_radios({
					container: fn.home.$container,
					name: "sliding_view",
					onChange: function(navSubtype) {
						fn.home.$preview.removeClass("tile list").addClass(navSubtype);
						fn.home.$navTypeList.data({
							navSubtype: navSubtype
						});

						var navType = $("#current_nav_type").val();
						fn.common.toggle_show_text(navType, navSubtype);

						$("#frm_design").removeClass("sliding_tile sliding_list").addClass("sliding_" + navSubtype);
					}
				});
			},

			toggle_addi_shortcuts_section: function(navType) {
				var rows = $("#sel_rows", fn.home.$container).val();
				var with_moreview = $("#sel_with_moreview").val();

				if (navType == "bottom" && (rows <= 1 || with_moreview == 1)) {
					$('.highlight-addi-track', fn.home.$preview).show();
				} else {
					$('.highlight-addi-track', fn.home.$preview).hide();
				}

				if (rows == 1 || with_moreview == 1 || navType == "sliding") {
					$(".nav-addi-btns, .nav-shortcuts", fn.home.$container).slideDown({
						progress: fn.common.auto_scroll
					});
				}
			},

			toggleNavTypeOverlay: function(overlay) {
				var overlay = overlay || false;

				if (!overlay) return false;

				var rows = $("#sel_rows", fn.home.$container).val();
				var navType = this.$navTypeList.data("navType");
				var with_moreview = $("#sel_with_moreview").val();

				$(".sub-nav-overlay", fn.home.$container).toggleClass("hide", ((navType == "bottom" && (rows == 1 || with_moreview == 1)) || navType == "sliding"));

				$(".sub-nav-overlay", fn.home.$container).css("height", $(".nav-addi-btns", fn.home.$container).outerHeight() + $(".nav-shortcuts", fn.home.$container).outerHeight() + "px");
				$(window).on("resize", function() {
					$(".sub-nav-overlay", fn.home.$container).css("height", $(".nav-addi-btns", fn.home.$container).outerHeight() + $(".nav-shortcuts", fn.home.$container).outerHeight() + "px");
				});
				$(".sidebar-footer .sidebar-toggler").on("click", function() {
					$(".sub-nav-overlay", fn.home.$container).css("height", $(".nav-addi-btns", fn.home.$container).outerHeight() + $(".nav-shortcuts", fn.home.$container).outerHeight() + "px");
				});
			},

			toggle_rows_cols_section: function(navType) {
				var with_moreview = $("#sel_with_moreview").val();
				var $rowsObj = fn.home.$container.find(".row-rows, span.in_each");

				if (navType == "bottom") {

					// 1 = Click List (with more_view), 0 = Touch Slide (without more_view)
					if (with_moreview == 1) {
						$rowsObj.hide();
					} else {
						$rowsObj.show();
					}
				} else if (navType == "top" || navType == "edges") {
					// If Top, Left or Right, always hide ROWS option, just show Cols
					$rowsObj.hide();
				}
			},

			resetHeader: function($flyup) {
				var image_overlay_color = $("#header_tint").val();
				var image_overlay_opacity = $("#header_tint_opacity").val();

				$flyup.find("#color_picker_header_tint").colpickSetColor(image_overlay_color).end()
					.find("#range_header_tint_opacity").val(image_overlay_opacity).rangeslider("update", true);
			},

			updateHeaderCss: function() {
				var $flyup = $(".flyup-home_header");
				if ($flyup.find(".block-g_no_image").hasClass("active")) {

					var opacity = 0;
					var bgColor = "ffffff";
				} else {
					var opacity = $flyup.find("#range_header_tint_opacity").val() / 100.0;
					var bgColor = $flyup.find("#header_tint_flyup").val();
				}

				var $style = $("style#css_home_header");
				var dim = g_vars.dimensions.header.all.thumb;
				var strCss =
					".flyup-home_header .block.active a.select-item:before {" + "width: " + dim.width + "px;" + "height: " + dim.height + "px;" + "background-color: #" + bgColor + ";" + "opacity: " + opacity + ";" + "}" + ".highlight-header-bg div.overlay {" + "background-color: #" + bgColor + ";" + "opacity: " + opacity + ";" + "}";

				$style.html(strCss);

				var $header_overlay = $(".highlight-header-bg .overlay", fn.home.$preview);
				$header_overlay.css("opacity", opacity);
			},

			updateBackgroundColor: function($flyup) {
				var bg_color = $("#home_bg_color_flyup").val();
				var is_blur = $("input[name=flyup_blur_home_screen]").prop("checked");

				if ($(".home-bg-picker").data("jflyup").getActiveDevice() != "tablet") {
					$(".highlight-screen-bg .inner img.home-bg").css({
						"background-color": "#" + bg_color,
					});
				}
				if ($(".home-bg-picker").data("jflyup").getActiveBlock().data("id") == "g_no_image") {
					$(".home-bg-picker").data("jflyup").getActiveBlock().find("img").hide();
				} else {
					$(".home-bg-picker").data("jflyup").$flyup.find(".block-g_no_image img").show();
				}

				$(".home-bg-picker").data("jflyup").$flyup.find(".block a.select-item").css("background-color", "initial");
				$(".home-bg-picker").data("jflyup").getActiveBlock().find("a.select-item").css("background-color", "#" + bg_color);

				$(".highlight-screen-bg .inner.hl-home-bg").toggleClass("blur", is_blur);
				$(".hls-sliding-nav .hls-sliding-nav-bg.blur").css("background-color", "#" + bg_color);
				$(".home-bg-picker").data("jflyup").getActiveBlock().toggleClass("blur", is_blur);
			},

			resetScreenBackground: function($flyup) {
				var home_bg_color = $("#home_bg_color").val();
				fn.common.skipRender = true;
				$flyup.find("#color_picker_home_bg").colpickSetColor(home_bg_color).end()

				var blur_home_screen = parseInt($("#blur_home_screen").val());
				$flyup.find("input[name=flyup_blur_home_screen]").data("prev", blur_home_screen);
				$flyup.find("#togglebox_blur_home_screen").toggleboxSet(blur_home_screen);

				$(".highlight-screen-bg .inner").toggleClass("blur", blur_home_screen == 1);
				$(".highlight-screen-bg .inner img.home-bg").css("background-color", "#" + home_bg_color);
				$(".hls-sliding-nav .hls-sliding-nav-bg.blur").css("background-color", "#" + home_bg_color);
			},

			init_flyups: function() {

				// Home Header Background
				$(".home-header-picker").flyup({
					name: "home_header",
					rows: 3,
					devices: ["all"],
					dimension: {
						all: g_vars.dimensions.header.all.thumb
					},
					list: {
						all: g_vars.home_header
					},
					elements: {
						all: fn.home.$ele.header
					},
					industries: g_vars.header_industry_options,

					onBeforeSlide: function() {

						//Select No-image block for upexpected case
						var $preview = $(".highlight-header-bg");
						if ($preview.hasClass("no_image")) {
							this.$flyup.find(".block-g_no_image").addClass("selected").addClass("active");
						}

						fn.home.updateHeaderCss();
						fn.home.resetHeader(this.$flyup);
						fn.common.hide_applause_popup();

						this.toggle_noImageSection();
						this.toggleTab();
						this.backup_flyup_data();
						this.enableSaveButton(false);

					},

					onSelect: function(device, $block) {
						var url;

						if ($block.data("id") != "g_no_image") {
							url = $block.data("url");
						} else {
							url = $block.data("realUrl");
						}

						var $preview = $(".highlight-header-bg");
						$preview.toggleClass("no_image", $block.hasClass("block-g_no_image"));
						$preview.find("img.preview").attr({
							src: url
						});

						this.toggle_noImageSection();

						fn.home.updateHeaderCss();
					},

					onHidden: function() {
						$(".highlight-header-bg").removeClass("selected");
						fn.common.check_changed();
					},

					onCancel: function() {
						var $preview = $(".highlight-header-bg");
						if (g_vars.home_header.active.id == "g_no_header") {
							//Remove other Active block for upexpected case
							this.$flyup.find(".body-device .active").removeClass("active");
							this.$flyup.find(".block-g_no_image").addClass("selected").addClass("active");

							$preview.addClass("no_image");
							$preview.find("img.preview").attr({
								src: g_vars.home_header.active.real_url
							});
						}
						fn.home.resetHeader(this.$flyup);
					},

					onSave: function() {
						var image_overlay_color = this.$flyup.find("#header_tint_flyup").val();
						var image_overlay_opacity = this.$flyup.find("#range_header_tint_opacity").val();
						$("#header_tint").val(image_overlay_color);
						$("#header_tint_opacity").val(image_overlay_opacity);
					}
				});

				$(".flyup-home_header").on("change", "#range_header_tint_opacity", function() {
					fn.home.updateHeaderCss();
				}).on("change", "#header_tint_flyup", function() {

				}).on("uploaded.flyup", function(e, data) {
					$(".global-header-picker").flyup("reload", data.device);
				}).on("deleted.flyup", function(event, data) {
					$(".global-header-picker").flyup("reload", data.device);
				});

				// Home Screen Background
				var bg_dim = g_vars.dimensions.bg;
				$(".home-bg-picker").flyup({
					name: "home_bg",
					category: "bg",
					rows: 1,

					devices: ["phone", "tablet"],
					dimension: {
						phone: bg_dim.phone.thumb,
						tablet: bg_dim.tablet.thumb
					},

					list: {
						phone: {
							//default: g_vars.bg.default.phone,
							no_image: g_vars.bg.no_image.phone,
							lib: g_vars.bg.lib.phone,
							active: g_vars.home_bg.phone.active,
							custom: g_vars.bg.custom.phone
						},

						tablet: {
							//default: g_vars.bg.default.tablet,
							no_image: g_vars.bg.no_image.tablet,
							lib: g_vars.bg.lib.tablet,
							active: g_vars.home_bg.tablet.active,
							custom: g_vars.bg.custom.tablet
						},
					},

					industries: g_vars.bg_industries,

					elements: {
						phone: fn.home.$ele.bg.phone,
						tablet: fn.home.$ele.bg.tablet,
					},

					onBeforeSlide: function() {
						this.toggleTab4ActiveDevice();

						var blur_home_screen = parseInt($("input[name=blur_home_screen]").val()); // 1 or 0
						this.$flyup.find("input[name=flyup_blur_home_screen]").data("prev", blur_home_screen);
						this.$flyup.find("#togglebox_blur_home_screen").toggleboxSet(blur_home_screen);

						if (fn.home.hasSlider) {
							$('.highlight-screen-bg .inner', fn.home.$preview).find(".cloud-container").hide();
						}

						this.backup_flyup_data();
						this.enableSaveButton(false);
						fn.common.hide_applause_popup();
					},

					onHidden: function() {
						// Check Blur and Preview slider again if it has slider.
						fn.home.check_blur_status();
						if (fn.home.hasSlider) {
							fn.home.render_slider_picker();
						}

						$(".highlight-screen-bg").removeClass("selected");
						if ($("#current_nav_type").val() == "sliding" && $("input[name=home_bg_phone]").val()) {
							$(".hls-sliding.overlay", fn.home.$preview).show();
						} else {
							$(".hls-sliding.overlay", fn.home.$preview).hide();
						}
						fn.common.check_changed();
					},

					onCancel: function() {
						fn.home.resetScreenBackground(this.$flyup);
					},

					onSave: function() {
						var home_bg_color = this.$flyup.find("#home_bg_color_flyup").val();
						$("#home_bg_color").val(home_bg_color);

						var blur_home_screen = (this.$flyup.find("input[name=flyup_blur_home_screen]").prop("checked")) ? 1 : 0;
						$("#blur_home_screen").val(blur_home_screen).change();

						var $block = this.getActiveBlock("phone");
						if ($block && $block.length > 0) {
							var url;
							if ($block.hasClass("no-image")) {
								url = $block.data("realUrl");
							} else {
								url = $block.data("url");
							}

							$(".hl-home-bg img.home-bg").attr({
								"src": url
							});
							$(".hl-home-bg.hls-sliding-nav-bg").css({
								"background-image": 'url(' + url + ')'
							});
						}

						fn.nav.updateIconColorForWhite();
					},

					render: function(device, $block) {

						if ($block && $block.length > 0) {
							var url;
							if ($block.hasClass("no-image")) {
								url = g_vars.bg.no_image.phone.real_url;
							} else {
								url = $block.data("url");
							}

							if (device != "tablet") {
								$(".hls-sliding.overlay", fn.home.$preview).hide();
								$(".hl-home-bg img.home-bg").attr({
									"src": url
								});
							}
							fn.home.updateBackgroundColor();
						}

					}

				});

				$(".flyup-home_bg").on("change", "input[name=flyup_blur_home_screen]", function() {
					fn.home.updateBackgroundColor();
				});
				// Home Slider Images
				var slider_dim = g_vars.dimensions.slider;
				$(".home-slider-picker").flyup({
					name: "home_slider",
					category: "bg",
					rows: 2,
					devices: ["phone", "tablet"],
					dimension: {
						phone: slider_dim.phone.thumb,
						tablet: slider_dim.tablet.thumb
					},
					list: {
						phone: {
							lib: g_vars.slider.lib.phone,
							custom: g_vars.slider.phone.custom,
							active: g_vars.slider.phone.active,
							sliding_mode: g_vars.slider.phone.sliding_mode
						},
						tablet: {
							lib: g_vars.slider.lib.tablet,
							custom: g_vars.slider.tablet.custom,
							active: g_vars.slider.tablet.active,
							sliding_mode: g_vars.slider.tablet.sliding_mode
						},
					},
					elements: {
						phone: fn.home.$ele.bg.phone,
						tablet: fn.home.$ele.bg.tablet,
					},

					hasNoImage: false,

					industries: g_vars.bg_industries,

					onBeforeSlide: function() {
						this.backup_flyup_data();
						this.enableSaveButton(false);

						//Disable Editor/Trash/Download
						this.enableButtons(false, false);
						fn.common.hide_applause_popup();
					},

					onSave: function() {
						
					},

					onCancel: function() {
						if (this.config.is_deleted) {
							fn.common.enableSaveButton(true);
						}
						
					},

					onHidden: function() {

						fn.home.hasSlider = false;
						for (index in g_vars.slider.phone.active) {
							if (!$.isEmptyObject(g_vars.slider.phone.active[index].filename)) {
								fn.home.hasSlider = true;
								break;
							}
						}
						fn.home.check_blur_status();
						$(".highlight-screen-bg").removeClass("selected");

						fn.home.render_slider_picker();
						fn.common.check_changed();
					}
				});

				// CV-476 - Design: Images should remove from assigned section when deleted
				$(".flyup-home_bg").on("deleted.flyup", function(event, data) {
					fn.common.reload_bg_flyup("home_slider", data);
					fn.common.reload_bg_flyup("global_bg", data);

				}).on("uploaded.flyup", function(event, data) {
					$(".home-slider-picker, .global-bg-picker").flyup("reload", data.device);
				});

				$(".flyup-global_bg").on("deleted.flyup", function(event, data) {
					fn.common.reload_bg_flyup("home_slider", data);
					fn.common.reload_bg_flyup("home_bg", data);

				}).on("uploaded.flyup", function(event, data) {
					$(".home-slider-picker, .home-bg-picker").flyup("reload", data.device);
				});

				$(".flyup-home_slider").on("deleted.flyup", function(event, data) {
					fn.common.reload_bg_flyup("home_bg", data);
					fn.common.reload_bg_flyup("global_bg", data);

				}).on("uploaded.flyup", function(event, data) {
					$(".home-bg-picker, .global-bg-picker").flyup("reload", data.device);

				});

				// WEBSER-753 Preview slider when change Sliding Mode
				
				$(".flyup-home_slider").on("change", "#sliding_mode_phone", function(){
					var _this = this;
					
					fn.home.sliderPhone = [];

					$(_this).closest(".phone-only").find(".slide .bg").each(function(i) {
						fn.home.sliderPhone.push({real_url: $(this).data('realUrl')});
					});

					fn.home.render_slider_picker($(_this).val(), true);
				}).on("click", ".remove-slide-bg", function() {
					var _this = this;
					
					fn.home.sliderPhone = [];

					$(_this).closest(".phone-only").find(".slide .bg").each(function(i) {
						fn.home.sliderPhone.push({real_url: $(this).data('realUrl')});
					});

					fn.home.render_slider_picker($("#sliding_mode_phone").val(), true);
				
				});

			},

			/**
			 * Jul 30, 2015 - Austin L.
			 */
			draw_preview: function(overlay) {
				// Draw dices based on nav_type, rows and cols
				var rows = parseInt($("#sel_rows").val());
				var cols = parseInt($("#sel_cols").val());
				var navType = this.$navTypeList.data("navType");
				var navSubtype = this.$navTypeList.data("navSubtype");

				var $headerBg = this.$preview.find(".highlight-header-bg");
				var $screenBg = this.$preview.find(".highlight-screen-bg");

				var screenLeft = parseInt($screenBg.css("left"));
				var screenTop = parseInt($screenBg.css("top"));
				var screenWidth = parseInt($screenBg.css("width"));
				var screenHeight = parseInt($screenBg.css("height"));

				var screenRight = screenLeft + screenWidth;
				var screenBottom = screenTop + screenHeight;

				var with_moreview = $("#sel_with_moreview").val();
				var is_touch_slide = (with_moreview == 0);
				var is_click_list = (with_moreview == 1);

				var $hand = fn.home.$preview.find(".slide-hand");
				var $more = fn.home.$preview.find(".click-more-wrp");

				if (is_touch_slide) {
					$more.hide();
				} else {
					$more.show();
				}

				var c = g_vars["dimensions"]["dice"]["width"]; // block size
				var pw = 4; // padding horizontal
				var ph = 4; // padding vertical
				var sw; // spacing horizontal
				var sh; // spacing vertical
				var x, y; // horizontal and vertical position of block

				var i, j; // iterator
				var ix; // [i, j] => ix (2D iterator)

				if (navType == "top" || navType == "edges" || is_click_list) {
					rows = 1;
				}

				var top; // Nav top
				var height; // Nav height
				if (navType == "bottom" || navType == "top") {
					sh = 6;
					// height = ph * 2 + (sh + c) * rows - sh;
					height = screenWidth / cols * rows;
				} else if (navType == "edges") {
					height = $screenBg.outerHeight();

					if (cols == 5) {
						ph = 16;
					} else if (cols == 4) {
						ph = 20;
					} else if (cols == 3) {
						ph = 40;
					}

				}

				if (navType == "bottom") {
					top = screenTop + screenHeight - height;
				} else if (navType == "top" || navType == "edges") {

					var checked = $("input[name=with_status_bar]").prop("checked");

					top = screenTop;
					if (checked) {
						top += fn.home.preview.iosStatusBarHeight;
						if (navType == "edges") {
							height -= fn.home.preview.iosStatusBarHeight;
						}
					}
				}

				// top and height of Navigation
				var width = screenWidth;
				sw = (width - 2 - pw * 2 - c * cols) / (cols - 1);

				fn.home.$previewNav.css({
					top: top + "px",
					height: height + "px"
				});

				if (navType == "edges") {
					ph = 8;
					sh = (height - ph * 2 - c * cols) / (cols - 1);
					i = 1;
					for (var j = 1; j <= cols; j++) {
						var $dice = fn.home.$previewNav.find(".dice-" + j);
						x = 8;
						y = ph + (j - 1) * (c + sh);

						$dice.css({
							left: 0 + "%",
							top: (100 / cols) * (j - 1) + "%",
							width: 76 + "%",
							height: 100 / cols + "%",
						});
						if (is_click_list && j == cols) {
							$dice.hide();
							$more.css({
								left: 0 + "px",
								top: (100 / cols) * (j - 1) + "%",
								width: 76 + "%",
								height: 100 / cols + "%",
							}).show();
						} else if (!$dice.is(":visible")) {
							$dice.show();
						}
					}

				} else {
					for (var j = 1; j <= cols; j++) {
						for (var i = 1; i <= rows; i++) {
							// [1, 1] => 1, [1, 2] => 2, ... [2, 1] => 6, [2, 2] => 7, ... [5, 4] => 24, [5, 5] => 25
							ix = (i - 1) * cols + j;
							var $dice = fn.home.$previewNav.find(".dice-" + ix);
							x = pw + (j - 1) * (c + sw);
							y = ph + (i - 1) * (c + sh);

							$dice.css({
								left: (100 / cols) * (j - 1) + "%",
								top: (100 / rows) * (i - 1) + "%",
								width: 100 / cols + "%",
								height: 100 / rows + "%",
							});

							if (is_click_list && j == cols && rows == 1) {
								$dice.hide();
								$more.css({
									left: (100 / cols) * (j - 1) + "%",
									top: 0 + "px",
									width: 100 / cols + "%",
									height: 100 + "%",
								}).show();
							} else if (!$dice.is(":visible")) {
								$dice.show();
							}
						}
					}

					if (cols == 3) {
						$(".highlight-addi-btn").css("top", "258px");
					} else if (cols == 4) {
						$(".highlight-addi-btn").css("top", "269px");
					} else if (cols == 5) {
						$(".highlight-addi-btn").css("top", "277px");
					}

					if (navType == "sliding") {
						$(".highlight-addi-btn").css("top", "313.5px");
					}
				}

				var maxIx = rows * cols;
				if (maxIx < 25) {
					for (ix = maxIx + 1; ix <= 25; ix++) {
						fn.home.$previewNav.find(".dice-" + ix).hide();
					}
				}

				var src = $hand.attr("src");
				if (navType == "bottom" || navType == "top") {
					newSrc = src.replace("hand_vert", "hand_horz");
				} else {
					newSrc = src.replace("hand_horz", "hand_vert");
				}

				/* --------------------------------------------------------------- */

				/* Hand Preview */
				$hand.attr("src", src);

				// Show slide icon
				var hw = $hand.width();
				var hh = $hand.outerHeight();

				var handLeft;
				var handTop;
				if (navType == "bottom" || navType == "top") {
					if (navType == "bottom") {
						handLeft = screenRight - hw - c * 0.8;
						handTop = fn.home.$preview.height() - hh - c;
					} else {
						handLeft = screenLeft + (width - hw) / 2;
						handTop = top + 20;
					}
				} else if (navType == "edges") {
					handTop = top + (height - hh) / 2;
					if (navSubtype == "left") {
						handLeft = screenLeft;
					} else {
						handLeft = screenRight - hw;
					}
				}
				$hand.css({
					left: handLeft + "px",
					top: handTop + "px"
				});

				if (with_moreview == 0 && navType != "sliding") {
					$hand.show();
				} else {
					$hand.hide();
				}

				/* ------------------------------ end ----------------------------- */

				$("#frm_design").toggleClass("multi-row", (navType == "bottom" && rows > 1));

				/* ---------------- Tab button, Font size ----------------------*/
				var $dice_label = $(".dice .dice-label", this.$preview);
				var $dice_tab_icon = $(".highlight.default.dice .dice-tab-icon", this.$preview);
				var $more_label = $(".dice-label", $more);
				var $more_tab_icon = $(".dice-tab-icon", $more);

				$dice_label.add($more_label).css("top", "75%");

				if (cols == 3) {
					$dice_label.add($more_label).css("font-size", "10px");
					$dice_tab_icon.add($more_tab_icon).css({
						"width": 30 + "px",
						"height": 30 + "px",
						"top": "45%"
					});
				} else if (cols == 4) {
					$dice_label.add($more_label).css("font-size", "9px");

					if (navType == "bottom" || navType == "top") {
						$dice_tab_icon.add($more_tab_icon).css({
							"width": 23 + "px",
							"height": 23 + "px",
							"top": "40%"
						});
					} else {
						$dice_tab_icon.add($more_tab_icon).css({
							"width": 30 + "px",
							"height": 30 + "px"
						});
					}

				} else if (cols == 5) {
					$dice_label.add($more_label).css("font-size", "6px");
					$dice_tab_icon.add($more_tab_icon).css({
						"width": 20 + "px",
						"height": 20 + "px",
						"top": "43%"
					});
				}

				if (navType == "edges") {
					$dice_tab_icon.css("top", "50%");
					$dice_label.add($more_label).css("top", "75%");

				} else if (navType == "sliding") {
					$dice_tab_icon.css({
						"width": 27 + "px",
						"height": 27 + "px",
						"top": "50%"
					});
				} else {
					$dice_label.add($more_label).css("top", "auto");
				}
				$more_tab_icon.css("top", "50%");

				/* ----------------- Tab button, Font size End ----------------------*/

				if (navType == "top") {
					fn.home.$preview.find(".highlight-header-bg").hide();
				} else {
					fn.home.$preview.find(".highlight-header-bg").show();
				}

				fn.home.toggleNavTypeOverlay(overlay);

			},

			// Home Container Bind Events
			bind_events: function() {

				if ($("li.nav-type.active").data("val") == "sliding" && $("input[name=home_bg_phone]").val()) {
					$(".hls-sliding.overlay", fn.home.$preview).show();
				} else {
					$(".hls-sliding.overlay", fn.home.$preview).hide();
				}


				/*  ------ Home Container Click Events ------ */

				// 1. Change Nav Type (bottom, top, left, right, edge)
				fn.home.$navTypeList.on("click", "li.nav-type", function() {
					var $this = $(this);
					var navType = $this.data("val");
					var navSubtype = '';

					$("#current_nav_type").val(navType).change();

					var withMore = $("#sel_with_moreview").val();
					var isTouchSlide = (withMore == 0);
					var isClickList = (withMore == 1);

					$this.siblings().removeClass("active");
					$this.addClass("active");
					$("#subsection_nav_type").attr("class", 'nav-type-section sub-section ' + navType);

					// Update Preview
					var previewClass = "setting-preview " + navType;
					var navTypeFull = navType;

					if (navType == 'edges') {
						if (fn.home.$container.find('#side_edges_position_right').prop('checked')) { // Right
							navSubtype = "right";
							previewClass += ' right';
						} else {
							navSubtype = "left";
							previewClass += ' left';
						}
					} else if (navType == "sliding") {
						// Tile or List
						navSubtype = $("input[name=sliding_view]:checked").val();
						// previewClass += " " + navSubtype;
						previewClass += " " + 'hover-addtional-buttons';
					}

					if (navSubtype) {
						navTypeFull += "_" + navSubtype;
					}

					// Check if the ios status bar is set.
					if (!fn.home.$container.find("input[name=with_status_bar]").prop("checked")) {
						previewClass += ' without-status-bar';
					}

					if (!fn.nav.$container.find("input[name=show_tab_icon]").prop("checked")) {
						previewClass += ' hide-tab-icon';
					}

					if (!fn.nav.$container.find("input[name=tab_showtext]").prop("checked")) {
						previewClass += ' hide-tab-label';
					}

					if (navType == "sliding") {
						fn.home.$preview.find(".highlight-header-bg").show();
						fn.home.$preview.filter(".sliding").find(".hls-sliding-col").addClass("selected");
						if (isClickList) {
							fn.home.$container.find(".nav-more-text").slideUp();
						}

						$(".nav-shortcuts", fn.home.$container).show();
						if ($("input[name=home_bg_phone]").val()) {

							$(".hls-sliding.overlay", fn.home.$preview).show();
						} else {
							$(".hls-sliding.overlay", fn.home.$preview).hide();
						}
					} else if (navType == "top") {
						// CV-2778
						fn.home.$preview.find(".highlight-header-bg").hide();
					} else {
						fn.home.$preview.find(".highlight-header-bg").show();
						fn.home.$preview.find(".hls-sliding-col").removeClass("selected");
						if (isClickList) {
							fn.home.$container.find(".nav-more-text").slideDown();
						}
						$(".hls-sliding.overlay", fn.home.$preview).hide();
					}

					previewClass += " auto-scrolling";
					fn.home.$preview.attr('class', previewClass);

					fn.home.$navTypeList.data({
						navType: navType,
						navSubtype: navSubtype
					});

					fn.home.toggle_rows_cols_section(navType);
					fn.home.toggle_addi_shortcuts_section(navType);
					fn.home.draw_preview(true);
					fn.common.auto_scroll();

					// CV-472: Design: Using slider list layout buttons text will be always enabled
					fn.common.toggle_show_text(navType, navSubtype);

					$("#frm_design").removeClass("bottom top edges_left edges_right sliding_tile sliding_list").addClass(navTypeFull);
				});


				/*  ------ Home Container MouseEnter & MouseLeave Events ------ */

				// .1 Hover Nav Type for Resting State (bottom, top, left, right, edge)
				fn.home.$container.on("mouseenter", "li.nav-type, .sliding_view", function() {
					var $this = $(this);
					var navType = $this.hasClass("sliding_view") ? fn.home.$container.find("li.nav-type-sliding").data("val") : $this.data("val");
					var navSubtype = '';

					$("#current_nav_type").val(navType);

					var withMore = $("#sel_with_moreview").val();
					var isTouchSlide = (withMore == 0);
					var isClickList = (withMore == 1);

					// Update Preview
					var previewClass = "setting-preview " + navType;
					var navTypeFull = navType;

					if (navType == 'edges') {
						if (fn.home.$container.find('#side_edges_position_right').prop('checked')) { // Right
							navSubtype = "right";
							previewClass += ' right';
						} else {
							navSubtype = "left";
							previewClass += ' left';
						}
					} else if (navType == "sliding") {
						// Tile or List
						navSubtype = $("input[name=sliding_view]:checked").val();

						// For Tile, List Toggle Box
						if ($this.hasClass("sliding_view")) {
							navSubtype = $this.data("val");
						}

						previewClass += " " + navSubtype;
					}

					fn.home.$navTypeList.data({
						navType: navType,
						navSubtype: navSubtype
					});

					if (navSubtype) {
						navTypeFull += "_" + navSubtype;
					}

					// Check if the ios status bar is set.
					if (!fn.home.$container.find("input[name=with_status_bar]").prop("checked")) {
						previewClass += ' without-status-bar';
					}

					if (!fn.nav.$container.find("input[name=show_tab_icon]").prop("checked")) {
						previewClass += ' hide-tab-icon';
					}

					if (!fn.nav.$container.find("input[name=tab_showtext]").prop("checked")) {
						previewClass += ' hide-tab-label';
					}

					if (navType == "sliding") {
						fn.home.$preview.find(".highlight-header-bg").show();
						fn.home.$preview.filter(".sliding").find(".hls-sliding-col").addClass("selected");
						if (isClickList) {
							fn.home.$container.find(".nav-more-text").slideUp();
						}

						$(".nav-shortcuts", fn.home.$container).show();
						if ($("input[name=home_bg_phone]").val()) {

							$(".hls-sliding.overlay", fn.home.$preview).show();
						} else {
							$(".hls-sliding.overlay", fn.home.$preview).hide();
						}
					} else if (navType == "top") {
						// CV-2778
						fn.home.$preview.find(".highlight-header-bg").hide();
					} else {
						fn.home.$preview.find(".highlight-header-bg").show();
						//fn.home.$preview.find(".hls-sliding-col").removeClass("selected");
						if (isClickList) {
							fn.home.$container.find(".nav-more-text").slideDown();
						}
						$(".hls-sliding.overlay", fn.home.$preview).hide();
					}

					previewClass += " auto-scrolling";
					fn.home.$preview.attr('class', previewClass);

					fn.home.toggle_addi_shortcuts_section(navType);
					fn.home.draw_preview(false);

					$("#frm_design").removeClass("bottom top edges_left edges_right sliding_tile sliding_list").addClass(navTypeFull);

					return true;

				}).on("mouseleave", "li.nav-type, .sliding_view", function() {
					var $this = $(this);
					var current_nav_type = fn.home.$container.find(".nav-type.active").data("val");
					var navSubtype = '';
					var previewClass = "setting-preview auto-scrolling " + current_nav_type;

					$("#current_nav_type").val(current_nav_type);

					if (current_nav_type == 'edges') {
						if (fn.home.$container.find('#side_edges_position_right').prop('checked')) { // Right
							navSubtype = "right";
							previewClass += ' right';
						} else {
							navSubtype = "left";
							previewClass += ' left';
						}
					} else if (current_nav_type == "sliding") {
						// Tile or List
						navSubtype = $("input[name=sliding_view]:checked").val();

						// For Tile, List Toggle Box
						if ($this.hasClass("sliding_view")) {
							navSubtype = $this.data("val");
						}

						previewClass += " " + navSubtype + " " + 'hover-addtional-buttons';
					}

					if (current_nav_type == "sliding") {
						previewClass += " " + 'hover-addtional-buttons';
					}

					// Check if the ios status bar is set.
					if (!fn.home.$container.find("input[name=with_status_bar]").prop("checked")) {
						previewClass += ' without-status-bar';
					}

					if (!fn.nav.$container.find("input[name=show_tab_icon]").prop("checked")) {
						previewClass += ' hide-tab-icon';
					}

					if (!fn.nav.$container.find("input[name=tab_showtext]").prop("checked")) {
						previewClass += ' hide-tab-label';
					}

					fn.home.$navTypeList.data({
						navType: current_nav_type,
						navSubtype: navSubtype
					});

					fn.home.toggle_addi_shortcuts_section(current_nav_type);
					fn.home.$preview.removeClass().addClass(previewClass);
					fn.home.draw_preview(false);

				});

				fn.home.$container.on("mouseenter", "div[data-flyup-name=home_bg]", function() {
					var $inner = $('.highlight-screen-bg .inner', fn.home.$preview);

					$inner.find(".cloud-container").hide();
				}).on("mouseleave", "div[data-flyup-name=home_bg]", function() {
					var $inner = $('.highlight-screen-bg .inner', fn.home.$preview);

					$inner.find(".cloud-container").show();
				});

				/*  ------ Home Container Change Events ------ */

				fn.home.$container.on("change", "input[name=with_status_bar]", function() { // Change Status Bar Toggle
					if ($(this).is(":checked")) {

						fn.home.$preview.removeClass("without-status-bar");
					} else {
						fn.home.$preview.addClass("without-status-bar");
					}

					fn.home.draw_preview(true);
				}).on("change", "input.ios_android", function() { // Change Addi Buttons
					var selector = $(this).data("target");
					var key = $(this).data("key");
					var btn_keys = '';
					var className = "highlight-addi-track";

					if ($(this).prop("checked")) {
						$(selector).removeClass("highlight-hidden");
					} else {
						$(selector).addClass("highlight-hidden");
					}

					fn.home.$container.find("input.ios_android").each(function(idx, itm) {
						if ($(itm).prop('checked')) {
							btn_keys += $(itm).data('key');
						}
					});

					if (btn_keys) {
						className += " highlight-addi-track-" + btn_keys;
					}

					fn.home.$preview.find('.highlight-addi-track').attr("class", className);

				}).on("change", "#sel_rows, #sel_with_moreview", function() { // Change Cols and Rows 

					var $addi = fn.home.$container.find(".additional-buttons");
					var rows = $("#sel_rows").val();
					var with_moreview = $("#sel_with_moreview").val();
					var navType = fn.home.$navTypeList.data("navType");

					fn.home.toggle_addi_shortcuts_section(navType);
					fn.home.toggleNavTypeOverlay(true);

					fn.home.draw_preview(true);

				}).on("change", "#sel_cols", function() { // Change columns for Nav Type
					fn.home.draw_preview(true);

				}).on("change", "#sel_with_moreview", function() { // Change Selection with More View

					if ($(this).val() == 1) {
						$(".nav-more-text").slideDown();
					} else {
						$(".nav-more-text").slideUp();
					}

					var navType = fn.home.$navTypeList.data("navType");

					fn.home.toggle_rows_cols_section(navType);
					fn.home.draw_preview(true);

				}).on("change", "#blur_home_screen", function() { // Home Blur Toggle Change Event
					// $('.highlight-screen-bg', fn.home.$preview).toggleClass("has-blur", $(this).val())
				});

				// Hover More
				$("#subsection_nav_type .top-space").first().add($("#subsection_nav_type .nav-shortcut-layout")).hover(function() {
					$(".click-more-wrp").toggleClass("selected");
				});

				// Check Header Overlay
				var $header_overlay = $(".highlight-header-bg .overlay", fn.home.$preview);
				if (g_vars.home_header.active.id == "" || g_vars.home_header.active.id == "g_no_image") {
					$header_overlay.css("opacity", "0");
				}

				// Init Slider Picker;
				fn.home.render_slider_picker();
				fn.home.init_check_radios();

			},

			// Check Blur Status of Home Preview
			check_blur_status: function() {
				var $inner = $('.highlight-screen-bg .inner', fn.home.$preview);

				if ($("input[name=blur_home_screen]").val() == 1) {
					$inner.addClass("blur");
				}
			},

			render_slider_picker: function(sliding_mode, flyup_opened) {
				
				var flyup_opened = flyup_opened || false;
				var $inner = $('.highlight-screen-bg .inner', fn.home.$preview);
				var html = '', sliderImg = [];

				var home_bg = $inner.find("img.home-bg").prop('outerHTML');

				html += home_bg;
				html += '<div class="cloud-slider">';
				
				if (!sliding_mode) {
					sliding_mode = g_vars.slider.phone.sliding_mode;
				}

				for (var i = 5; i >= 1; i--) {
					
					if (flyup_opened) {
						sliderImg = fn.home.sliderPhone[5-i];
					} else {
						sliderImg = g_vars.slider.phone.active[i];
					}

					if (typeof sliderImg['real_url'] == "undefined" || sliderImg['real_url'] == "") {
						continue;
					}

					fn.home.hasSlider = true;

					var addtional_params = '';
					switch (sliding_mode) {
						case '0': // Disable
							addtional_params = '';
							break;
						case 'n1': // Sliding
							addtional_params = '';
							break;
						case 'n2': // Fade
							addtional_params = 'data-transition="3"';
							break;
						case 'm1': // Parallax
							addtional_params = 'data-parallex="true"';
							break;
						case 'm2': // Ken Burns
							addtional_params = 'data-transition="3" data-ken="scalefrom:1.4; positionfrom:center_center; scaleto:1; positionto:center_center; easing:linear; duration:7000;"';
							break;
						default:
					}

					html += '<div class="kr-sky" ' + addtional_params + '>' + '<img class="sky-background" src="' + sliderImg['real_url'] + '" />' + '</div>';
				}

				html += '</div>';

				fn.home.check_blur_status();
				$inner.html(html);

				$('.cloud-slider').cloudSlider({
					autoSlide: sliding_mode != 0,
					width: $('.highlight-screen-bg').width() + 2,
					height: ($('.highlight-screen-bg').height() + 2),
					progressBarPosition: 'hidden',
					fullSize: false,
					onHoverPause: false,
					navType: 'none',
					arrow: {
						visibility: 'hide'
					}
				});

			},

			init: function() {
				this.$container = $("#home_screen_section");
				this.$navTypeList = this.$container.find(".nav-type-list");
				this.$preview = this.$container.find(".setting-preview");
				this.$previewNav = this.$preview.find(".highlight-navigation");

				this.init_flyups();
				this.draw_preview(true);
				this.bind_events();

			}
		},

		// Home Screen / Shortcut
		shortcut: {

			$shortcut: $("#shortcut"),
			$modal: $("#modal_shortcut"),
			modal_id: false,

			/* Nov 20, 2015 - Austin */
			draw_preview: function() {
				// Draw shortcuts in preview
				var index = 1;
				var $row = $(".shortcut-row");
				fn.home.$preview.find(".hlsh").empty();
				$row.each(function() {
					var id = $(this).data("id");
					var sc = g_vars.shortcuts[id];
					if (typeof sc === "undefined") {
						console.error("[shortcut.draw_preview()] shortcut #" + id + " is not defined.");
						return true;
					}

					if (!sc.is_active || sc.hide) {
						// skip
						return true;
					}

					var extra = '';
					if (sc.icon.url.indexOf("no_button.png") != -1) {
						extra = ' class="hide"';
					}

					var html = '<img' + extra + ' src="' + sc.icon.url + '">' + '<span style="color: #' + sc.TabLableTextColor + '; text-shadow: #' + sc.TabLableTextBackgroundColor + ' 1px 1px 0px">' + sc.TabLabelText + '</span>';

					$(".hlsh-" + index).html(html);

					index++;
				});

				// Shortcut Label Width
				var checkerWidth = ($(".checker", $row).length == 1) ? $(".checker", $row).width() : 19;

				$(".shortcut-row label.icon-name").width($row.width() - checkerWidth - $(".fa", $row).width() - $(".togglebox", $row).width() - $("img", $row).width() - $("button", $row).width() - 58);
				$(window).on("resize", function() {
					$(".shortcut-row label.icon-name").width($row.width() - checkerWidth - $(".fa", $row).width() - $(".togglebox", $row).width() - $("img", $row).width() - $("button", $row).width() - 58);
				});
				$(".sidebar-footer .sidebar-toggler").on("click", function() {
					$(".shortcut-row label.icon-name").width($row.width() - checkerWidth - $(".fa", $row).width() - $(".togglebox", $row).width() - $("img", $row).width() - $("button", $row).width() - 58);
				});
			},

			compare: function(s1, s2) {
				var simple_fields = ['Custom_Icon', 'TabImage', 'TabLabelText', 'TabLableTextColor', 'TabLableTextBackgroundColor',
					'id', 'is_active', 'is_hide', 'link_tab_id'
				];

				var is_equal = true;
				simple_fields.forEach(function(field) {
					if (s1[field] != s2[field]) {
						is_equal = false;
						return false;
					}
				});

				if (s1.icon.id != s2.icon.id) {
					return false;
				}

				return is_equal;
			},

			backup_modal: function() {
				var $modal = $("#modal_shortcut");
				$("input:not(.check-all), select", $modal).each(function() {
					if ($(this).is("input[type=checkbox]")) {
						$(this).data("o_checked", $(this).prop("checked"));
					}

					$(this).data("o_value", $(this).val());
				});
				$("img.shortcut-dice", $modal).each(function() {
					$(this).data("o_src", $(this).attr("src"));

					var shortcut_id = $modal.data("id");
					if (typeof g_vars.shortcuts[shortcut_id] == "undefined") return true;
					$(this).data("o_name", g_vars.shortcuts[shortcut_id].TabImage);
				});
			},

			init_modal: function() {
				var $modal = $("#modal_shortcut");
				$("input:not(.check-all), select", $modal).each(function() {
					if ($(this).is("input[type=checkbox]")) {
						$(this).data("o_checked", "");
					}
					$(this).data("o_value", "");
				});
				$("img.shortcut-dice", $modal).each(function() {
					$(this).data("o_src", "");
				});
			},

			monitor_modal: function() {

				var $modal = $("#modal_shortcut");
				var is_changed = false;

				$("input:not(.check-all), select", $modal).each(function() {
					if ($(this).is("input[type=checkbox]")) {

						var new_status = $(this).prop("checked");
						if ($(this).data("o_checked") != new_status) {
							is_changed = true;
							return false;
						}
					} else {
						if ($(this).data("o_value") != $(this).val()) {
							is_changed = true;
							return false;
						}
					}
				});

				$("img.shortcut-dice", $modal).each(function() {
					//case for lib image
					if ($(this).attr("src").indexOf("custom") == -1) {

						if ($(this).data("o_src").indexOf("?v=") != -1) {
							if ($(this).data("o_src") != $(this).attr("src")) {
								is_changed = true;
								return false;
							}
						} else {
							if ($(this).data("o_src") != $(this).attr("src").split("?v")[0]) {
								is_changed = true;
								return false;
							}
						}
					} else { //case for custom image

						if (typeof $(this).data("o_src").split("com/")[1] == "undefined") return true;
						if ($(this).data("o_src").split("com/")[1].split("?e")[0] != $(this).attr("src").split("?v")[0]) {

							if ($(this).attr("src").split("?v")[0].indexOf($(this).data("o_name")) != -1) {
								is_changed = false;
							} else {
								is_changed = true;
								return false;
							}
						}
					}

				});

				if (is_changed) {
					$(".btn-submit", $modal).prop("disabled", false);
				} else {
					$(".btn-submit", $modal).prop("disabled", true);
				}
			},

			after_fixed_deleted_images: function(info) {
				var fixed_shortcut_ids = info.fixed_shortcut_ids;
				var deleted_filenames = info.deleted_filenames;
				if (fixed_shortcut_ids.length == 0 && deleted_filenames.length == 0) {
					return;
				}

				var sc, id;
				var $scRow;

				fixed_shortcut_ids.forEach(function(id) {

					// Modify the current dataset
					sc = g_vars.shortcuts[id];
					if (typeof sc == 'undefined') {
						return true;
					}
					sc["TabImage"] = "";
					sc["Custom_Icon"] = 0;
					sc["icon"]["url"] = "/images/theme_editor/no_button.png?v=" + version;
					sc["icon"]["filename"] = "no_button.png";
					sc["icon"]["id"] = "g_no_button";

					// Update icon in shortcut row
					$scRow = $('.shortcut-row[data-id=' + id + ']');
					$scRow.find('img.shortcut-icon').attr("src", "/images/theme_editor/no_button.png");
				});

				for (id in g_vars.shortcuts) {
					sc = g_vars.shortcuts[id];
					if (deleted_filenames.indexOf(sc["TabImage"]) != -1) {
						sc["TabImage"] = "";
						sc["Custom_Icon"] = 0;
						sc["icon"]["url"] = "/images/theme_editor/no_button.png?v=" + version;
						sc["icon"]["filename"] = "no_button.png";
						sc["icon"]["id"] = "g_no_button";

						// Update icon in shortcut row
						$scRow = $('.shortcut-row[data-id=' + id + ']');
						$scRow.find('img.shortcut-icon').attr("src", "/images/theme_editor/no_button.png");
					}
				}

				fn.common.check_changed();
				fn.shortcut.draw_preview();
			},

			on_shortcut_events: function() {

				if ($.isArray(g_vars["shortcuts"])) {
					// Turn shortcuts array to Objects
					g_vars["shortcuts"] = {};
				}

				// Add / Edit shortcut
				$.bind_modal({
					modal: "#modal_shortcut",
					selector: ".btn-add-edit-shortcut",
					onShow: function(e) {
						var $modal = this.modal;
						var $btn = $(this.delegator);
						var mode = $btn.data("editMode");
						$modal.find("label.error").remove().end()
							.find(".error").removeClass("error");

						var sc_url, has_icon = false;

						if (mode == "add") {
							$modal.addClass("add");
							sc_url = "/images/theme_editor/empty.png";
						} else {
							$modal.addClass("edit");

							sc_url = $btn.siblings("img.shortcut-icon").attr("src");

							if (sc_url.indexOf("no_button.png") == -1) {
								has_icon = true;
							} else {
								sc_url = "/images/theme_editor/empty.png";
							}
						}

						var shortcut_id = $btn.data("id");
						$modal.data({
							mode: mode,
							id: shortcut_id
						});
						fn.shortcut.modal_id = shortcut_id;
						var sc; // Shortcut info
						if (mode == "edit") {
							// Edit - load shortcut detail from g_vars["shortcuts"]
							sc = g_vars["shortcuts"][shortcut_id];
							if (sc.icon.filename == "no_button.png") {
								sc.icon.id = "";
								sc.icon.filename = "";
							}
						} else {
							// Add
							// Calculate sequence
							var $sbody = fn.shortcut.$container.find(".shortcuts-body");

							sc = {
								TabLabelText: "",
								link_tab_id: 0,
								TabLableTextColor: "000000",
								TabLableTextBackgroundColor: "FFFFFF",
								is_hide: 0,
								icon: {
									id: "",
									filename: ""
								},
								TabImage: ""
							};
						}
						if (typeof sc.TabImage != "undefined") {
							if (mode == "edit") {

								image_id = sc.TabImage.split(".")["0"].replace(/ /g, '');;
								if (image_id.indexOf("custom") == -1) {
									image_id = "g_" + image_id;
									if (image_id == "g_") {
										image_id = "";
									}
								}

							} else {
								image_id = "";
							}
						}

						$modal.find("#shortcut_title").val(sc.TabLabelText).end()
							.find("#tab_image").val(sc.TabImage).end()
							.find("#sel_view_controller").val(sc.link_tab_id).trigger("change").end()
							.find(".color-picker-subtab-text-color").colpickSetColor(sc.TabLableTextColor).end()
							.find(".color-picker-subtab-text-shadow").colpickSetColor(sc.TabLableTextBackgroundColor).end()
							.find(".togglebox-homescreen-only").toggleboxSet(sc.is_hide).end()
							.find("#shortcut").data(sc.icon).val(image_id).end();

						$modal.find("img.shortcut-dice").attr("src", sc_url).toggleClass("has-value", has_icon);

						$(".btn-submit", $modal).prop("disabled", true);

						fn.shortcut.backup_modal();
						if (mode == "edit") {

							$modal.on("change keyup", "input[type != togglebox], select#sel_view_controller, img.shortcut-dice", function() {

								if ($("select#sel_view_controller", $modal).val()) {
									fn.shortcut.monitor_modal();
								} else {
									$(".btn-submit", $modal).prop("disabled", true);
								}
							});

						} else {
							$modal.on("change keyup", "select#sel_view_controller, input", function() {
								if ($("select#sel_view_controller", $modal).val()) {
									fn.shortcut.monitor_modal();
								} else {
									$(".btn-submit", $modal).prop("disabled", true);
								}

							});
						}

						fn.common.updateHasValueSet("shortcut");

					},

					onHide: function() {
						this.modal.removeClass("add edit");
						$(".shortcut-picker", fn.shortcut.$modal).data("is_deleted", false);
						fn.common.check_changed();
					},

					onSubmit: function(flyup) {
						var $modal = this.modal;
						var $btn = $(this.delegator);
						var mode = $modal.data("mode");
						var $frm = $modal.find("form.form-design-shortcut");
						if (!$frm.valid()) {
							return false;
						}

						var shortcut_id = $modal.data("id");
						var data = {
							app_id: g_app_id,
							shortcut_id: shortcut_id,
							shortcut_filename: $("#shortcut").data("filename"),
						};

						if (typeof g_vars["shortcuts"][shortcut_id] != "undefined") {
							data.seq = g_vars["shortcuts"][shortcut_id].seq;
						}

						nt.clear();
						$modal.started();

						// route = design.render_shortcut
						$frm.ajaxSubmit({
							url: config.ajaxServiceUrl,
							data: data,
							complete: function() {
								$modal.completed();
							},
							success: function(json) {
								if (!json.success) {
									nt.error(json.msg);
									return false;
								}

								// Save back to g_vars
								g_vars.shortcuts[json.item.id] = json.item;

								// Render new layout
								var $sbody = fn.shortcut.$container.find(".shortcuts-body");
								$newItem = $(json.html);
								$newItem.find(".togglebox").togglebox();

								var $chk = $newItem.find(".shortcut_active");
								$chk.data("o_checked", $chk.prop("checked"));
								if (mode == "add") {
									$sbody.append($newItem);
								} else {
									$sbody.find(".shortcut-row-" + json.item.id).replaceWith($newItem);
								}

								biz.init_uniform($newItem);
								fn.shortcut.init_sortable();

								// Hide modal
								$modal.modal("hide");

								// Disable if there are already more than 6 shortcuts
								if ($sbody.find(".shortcut-row").length >= 6) {
									fn.shortcut.$container.find(".btn-add-shortcut").prop("disabled", true);
								}

								//fn.shortcuts.render();
								fn.shortcut.$checkall.prop("disabled", false).change();
								fn.shortcut.$container.removeClass("no-shortcut");

								fn.common.check_changed();
								fn.shortcut.draw_preview();
							},

							error: function() {
								nt.error(phrases.design_label_failed_save_shortcut);
							}
						});

						return false;
					}
				});

				// Toggle shortcut active status
				$(document).on("change", ".shortcut_active", function() {
					var sc_id = $(this).data("id");
					var is_active = $(this).prop("checked") ? 1 : 0;
					g_vars.shortcuts[sc_id].is_active = is_active;

					fn.common.check_changed();
					fn.shortcut.draw_preview();
				});
			},

			init_sortable: function() {
				this.$container.find(".shortcuts-body").sortable({
					itemClass: "shortcut-row",
					items: $(".shortcut-row"),
					handle: ".shortcut-handle"

				}).on("sortupdate", function() {
					// Update g_vars.shortcuts
					fn.shortcut.$container.find(".shortcut-row").each(function() {
						var $sc = $(this);
						var sc_id = $sc.data("id");

						g_vars.shortcuts[sc_id].seq = $sc.index() + 1;
					});

					fn.common.check_changed();
					fn.shortcut.draw_preview();
				});
			},

			init_modal_flyup: function() {
				var dim = g_vars.dimensions.shortcut;
				var $modal = $("#modal_shortcut");

				/* Shortcut flyup  */
				$(".shortcut-picker").flyup({
					name: "shortcut",
					devices: ["all"],

					dimension: {
						all: dim.all.thumb
					},
					list: {
						all: g_vars.shortcut_v2
					},

					industries: g_vars.shortcut_industry_options,

					elements: {
						all: fn.shortcut.$shortcut
					},

					onSave: function() {
						var $block = this.getActiveBlock();
						var sc_url = $block.data("realUrl");

						var has_icon = false;
						if ($block.data("id") != "g_no_image") {
							has_icon = true;
						}

						this.$flow.find("img.shortcut-dice").attr("src", sc_url).toggleClass("has-value", has_icon);
						fn.common.enableSaveButton(false);

						if (typeof g_vars["shortcuts"][fn.shortcut.modal_id] == "undefined") {
							return;
						}
						var tabImage = g_vars["shortcuts"][fn.shortcut.modal_id].TabImage;

						if ($(".shortcut-dice", $modal).attr("src").indexOf(tabImage) > -1) {
							$(".btn-submit", $modal).prop("disabled", true);
						} else {
							$(".btn-submit", $modal).prop("disabled", false);
						}

						fn.shortcut.monitor_modal();
					},

					onHide: function() {
						if (this.deleted.length > 0) {
							// Clear filename in DB records
							ajax.post("design.fix_deleted_shortcuts", {
								deleted: this.deleted
							}, function(json) {
								if (!json.success) {
									nt.error(json.msg);
									return false;
								}

								// Clear image and update g_vars.shortcut_backup and g_vars.shortcuts
								fn.shortcut.after_fixed_deleted_images(json.info);

								// Draw preview again
								fn.shortcut.draw_preview();
							});
						}
					},

					onCancel: function() {
						if (this.config.is_deleted) {
							$(".shortcut-dice", fn.shortcut.$modal).attr("src", "");
						}
					}
				});
			},

			init: function() {
				this.$container = $(".section-shortcuts");
				this.$checkall = this.$container.find("#shortcut_check_all");
				this.$trash = this.$container.find(".btn-trash-shortcut");

				biz.init_checkrows({
					container: ".section-shortcuts",
					buttonTrash: ".btn-trash-shortcut",
					checkRow: ".chk_row_shortcut",
					checkAll: "#shortcut_check_all"
				});

				this.init_sortable();

				// Add / Edit Shortcut
				this.on_shortcut_events();

				// Vertical flyup in the right of Shortcut modal
				this.init_modal_flyup();

				// Confirm remove shortcut
				this.$trash.bind_confirm({
					name: 'remove-shortcut-row',
					before: function() {
						var $chks = $("input.chk_row_shortcut:checked");
						if (!$chks.length) {
							return false;
						}

						$(this.modal).trigger('updateCheckList', [$.map($chks, function(itm) {
							var $row = $(itm).closest('div.shortcut-row');
							var cont = $row.find("label.icon-name").html();
							if (cont == "") cont = "(Untitled Shorcut)";
							var indv = $row.index() + 1;
							return '<li>' + indv + '. ' + cont + '</li>';
						}).join('')]);

						return true;
					},

					onSubmit: function() {
						var $chks = $("input.chk_row_shortcut:checked");
						var isRemovingAll = ($(".shortcuts-body").children().length == $chks.length);

						$chks.each(function() {
							$("#btn_add_shortcut").prop("disabled", false);
							var $row = $(this).closest("div.shortcut-row");
							var sc_id = $row.data("id");
							if (typeof g_vars.shortcuts[sc_id] !== "undefined") {
								delete g_vars.shortcuts[sc_id];
							}
							$row.fadeOut("fast", function() {
								$row.remove();
							});
						});

						$(".btn-trash-shortcut").prop("disabled", true);

						fn.shortcut.$checkall.prop("checked", false);
						$.uniform.update(fn.shortcut.$checkall);

						fn.shortcut.$container.toggleClass("no-shortcut", isRemovingAll);
						$(this).prop("disabled", true);

						setTimeout(function() {
							fn.common.check_changed();
							fn.shortcut.draw_preview();
						}, 500);
					}
				});

				this.draw_preview();
			}
		},

		// Navigation Buttons
		nav: {

			$container: false,
			$preview: false,

			$ele: {
				icon_color: $("input[name=tab_icon_color]"),
				tab_button: $("input[name=tab_button]")
			},

			updateIconColorPreview: function() {
				// Update the preview inside Flyup with current Icon Color
				var $obj = fn.nav.$preview.find("img.icon-color");
				$obj = $obj.add(fn.global.$preview.find("img.row-tab-icon"));

				var icon_color = $("#tab_icon_color").val();
				$obj.each(function() {
					var $img = $(this);
					var type = $img.data("type");
					var original = $img.data("original");
					var url = "";
					if (type == "traditional") {
						// PHP tint
						url = "/global/tint.php?filename=" + original + "&color=" + icon_color;
					} else if (type == "modern") {
						// SVG colorization
						url = "/global/svg.php?filename=" + original + "&color=" + icon_color;
					} else {
						return true;
					}

					$img.attr("src", url);
				});

				var src;
				$(".default-theme img.dice-tab-icon:not(.icon-color-shadow)").each(function() {
					src = biz.replaceSvgColor($(this).attr("src"), icon_color);
					$(this).attr("src", src);
				});
			},

			updateIconColorForWhite: function() {

				var $homebgpicker = $(".home-bg-picker", fn.home.$container).data("jflyup");
				var $tabbuttonpicker = $(".tab-button-picker", fn.nav.$container).data("jflyup");

				var hide_dice = !($("#home_bg_color_flyup", $homebgpicker.$flyup).val() == "ffffff" && $("#tab_icon_color", fn.nav.$container).val() == "ffffff" && ($homebgpicker.getActiveBlock().data("id") == "g_no_image" || typeof $homebgpicker.getActiveBlock().data("id") == "undefined"));
				var hide_preview = !($("#tab_icon_color", fn.nav.$container).val() == "ffffff" && ($("#tab_tint_flyup", $tabbuttonpicker.$flyup).val() == "ffffff" || $("#tab_tint_flyup", $tabbuttonpicker.$flyup).val() == "" || $("#range_tab_tint_opacity", $tabbuttonpicker.$flyup).val() / 100.0 == 0) && ($tabbuttonpicker.getActiveBlock().data("id") == "g_no_image" || typeof $tabbuttonpicker.getActiveBlock().data("id") == "undefined"));

				$(".dice-tab-icon.icon-color-shadow").toggleClass("hide", hide_dice);
				$(".preview.icon-color-shadow").toggleClass("hide", hide_preview);
			},

			updateTabButtonTextForWhite: function() {
				var $tabButtonColPicker = $("input[name=tab_text]", fn.nav.$container);

				var hide_text = !($tabButtonColPicker.val() == "ffffff");

				if ($("input[name=tab_showtext]", fn.nav.$container).prop("checked")) {
					$(".highlight-icon-text.icon-text-shadow", fn.nav.$container).toggleClass("hide", hide_text);
				}
				if ($tabButtonColPicker.val() == "ffffff") {
					$("#nav_preview_icon_name", fn.nav.$container).css("opacity", "0.8");
				} else {
					$("#nav_preview_icon_name", fn.nav.$container).css("opacity", "1");
				}

			},

			updateTabButtonText: function(hex) {
				$("#nav_preview_icon_name").css("color", "#" + hex);

				var $style = $("style#css_tab_text_color");
				var strCss =
					".has-tab.default-theme .dice-label {" + "color: #" + hex + "}";

				$style.html(strCss);
			},

			resetTabButton: function($flyup) {
				var image_overlay_color = $("#tab_tint").val();
				var image_overlay_opacity = $("#tab_tint_opacity").val();

				$flyup.find("#color_picker_tab_tint").colpickSetColor(image_overlay_color).end()
					.find("#range_tab_tint_opacity").val(image_overlay_opacity).rangeslider("update", true).end()
					.find("#tab_tint_flyup").val(image_overlay_color);
			},

			updateTabButtonFlyupCanvas: function($block, $flyup) {

				var $canvas_flyup, dim;
				var dimension = g_vars.dimensions.tab_button.all.thumb;

				if ($block.data("id") == "g_no_image") {
					$canvas_flyup = $(".canvas-no-image-tab-button-flyup", $block);
					dim = {
						width: dimension.noImageWidth,
						height: dimension.noImageHeight
					};
				} else {
					$canvas_flyup = $(".canvas-tab-button-flyup", $block);
					dim = {
						width: dimension.width,
						height: dimension.height
					};
				}

				if (typeof $canvas_flyup[0] == "undefined" || $flyup.find(".block.active").length > 1) return;

				var image_flyup = $block.find(".fimg")[0],
					context = $canvas_flyup[0].getContext("2d"),
					opacity = $flyup.find("#range_tab_tint_opacity").val() / 100.0,
					bgColor = $flyup.find("#tab_tint_flyup").val();

				fn.nav.getTabButtonCanvas($canvas_flyup[0], image_flyup, context, dim, bgColor, opacity);
				$canvas_flyup.css("opacity", opacity);
			},

			updateTabButtonCss: function() {

				var $flyup = $(".flyup-tab_button"),
					opacity = $flyup.find("#range_tab_tint_opacity").val() / 100.0,
					bgColor;

				if ($flyup.find("#tab_tint_flyup").val() != "") {
					bgColor = $flyup.find("#tab_tint_flyup").val();
				} else {
					bgColor = $("input[name=tab_tint]", fn.nav.$container).val();
				}

				var $style = $("style#css_tab_button");
				var dim = g_vars.dimensions.tab_button.all.thumb;
				var strCss =
					".flyup-tab_button .block.block-g_no_image.active a.select-item:before {" + "height: " + dim.noImageHeight + "px;" + "}" + ".hl-nav-tint {" + "background-color: #" + bgColor + ";" + "opacity: " + opacity + ";" + "}";

				$style.html(strCss);

				for (var i = 0, len = g_vars["app_preview_tabs"].length; i < len; i++) {
					if (g_vars["app_preview_tabs"][i]["app_id"] == "") {
						var seq = g_vars["app_preview_tabs"][i]["seq"] + 1;
						$(".dice-tint", $(".hls-col" + seq)).add($(".dice-tint", $(".dice-" + seq))).css({
							"background-color": "#" + bgColor,
							"opacity": opacity
						});
					}
				}

				// CV-487 Previewer Canvas, using DOM Element
				var canvas_tb = $("#canvas-tab-button-preview")[0],
					image_tb = $("#image-tab-button-design")[0];

				if (typeof canvas_tb == "undefined" || typeof image_tb == "undefined") return;

				var context = canvas_tb.getContext("2d"),
					dim = {
						width: 128,
						height: 128
					};

				//checking if image loaded or not
				var image = new Image();

				image.crossOrigin = "Anonymous";
				image.onload = function() {
					fn.nav.getTabButtonCanvas(canvas_tb, image_tb, context, dim, bgColor, opacity);
				}
				image.src = image_tb.src;

				if (typeof $flyup.find(".block.active").data("id") == "undefined" || $flyup.find(".block.active").data("id") == "g_no_image") {
					$("#canvas-tab-button-preview").css("background-color", "#" + bgColor);
				} else {
					$("#canvas-tab-button-preview").css("background-color", "transparent");
				}

			},

			fitImageOn: function(canvas, imageObj, context) {
				if (typeof canvas == "undefined" || typeof imageObj == "undefined" || typeof context == "undefined" || imageObj.naturalWidth == 0 || imageObj.naturalHeight == 0)
					return;

				var imageAspectRatio = imageObj.naturalWidth / imageObj.naturalHeight;
				var canvasAspectRatio = canvas.width / canvas.height;
				var renderableHeight, renderableWidth, xStart, yStart;

				// If image's aspect ratio is less than canvas's we fit on height
				// and place the image centrally along width
				if (imageAspectRatio > canvasAspectRatio) {
					renderableHeight = canvas.height;
					renderableWidth = imageObj.naturalWidth * (renderableHeight / imageObj.naturalHeight);
					xStart = (canvas.width - renderableWidth) / 2;
					yStart = 0;
				}

				// If image's aspect ratio is greater than canvas's we fit on width
				// and place the image centrally along height
				else if (imageAspectRatio < canvasAspectRatio) {
					renderableWidth = canvas.width;
					renderableHeight = imageObj.naturalHeight * (renderableWidth / imageObj.naturalWidth);
					xStart = 0;
					yStart = (canvas.height - renderableHeight) / 2;
				}

				// Happy path - keep aspect ratio
				else {
					renderableHeight = canvas.height;
					renderableWidth = canvas.width;
					xStart = 0;
					yStart = 0;
				}
				return context.drawImage(imageObj, xStart, yStart, renderableWidth, renderableHeight);
			},

			getTabButtonCanvas: function(canvas, image, ctx, dim, bgColor, opacity) {

				// 1. Change hex color to rgb and get each value,
				var rgb = parseInt(bgColor, 16); // convert rrggbb to decimal
				var r = (rgb >> 16) & 0xff; // extract red
				var g = (rgb >> 8) & 0xff; // extract green
				var b = (rgb >> 0) & 0xff; // extract blue

				// 2. Set the dimension of the overlay Canvas,
				canvas.height = dim.height;
				canvas.width = dim.width;

				// 3. Regulate the Canvas's coordinate and width & height, => aspect fill
				fn.nav.fitImageOn(canvas, image, ctx);

				// 4. Get the data of each pixel and update the data of every pixel with updated value.
				var imgData = ctx.getImageData(0, 0, 128, 257),
					pix = imgData.data;

				for (var i = 0, n = pix.length; i < n; i += 4) {

					if (pix[i + 3] > 0) // If it's not a transparent pixel
					{
						pix[i] = pix[i] / 255 * r;
						pix[i + 1] = pix[i + 1] / 255 * g;
						pix[i + 2] = pix[i + 2] / 255 * b;
					}
				}

				ctx.putImageData(imgData, 0, 0);

				// 5. Update Opacity.
				$("#canvas-tab-button-preview").css("opacity", opacity);

			},

			on_tab_showtext: function() {

				this.$container.on("change", "input[name=tab_showtext]", function() {
					var is_checked = $(this).prop("checked");
					if (is_checked) {
						fn.home.$preview.removeClass("hide-tab-label");
						fn.nav.$container.find(".highlight-icon-text").removeClass("hide highlight-hidden");
						$("#item_tab_text").slideDown();
					} else {
						fn.home.$preview.addClass("hide-tab-label");
						fn.nav.$container.find(".highlight-icon-text").addClass("hide");
						$("#item_tab_text").slideUp();
					}

					fn.nav.updateTabButtonTextForWhite();
					fn.nav.updateTabButtonText($("#tab_text", fn.nav.$container).val());
					$('.highlight-toggler', fn.nav.$container).on("click mouseenter", function(e) {
						var selector = $(this).data('highlight');
						selector = selector || '';
						if (!selector) {
							console.error("$.fn.highlight::[click, mouseenter] - The following element has not valid highlight selector.");
							console.log(this);
							return;
						}

						var $target = $(selector);
						$target.addClass('selected');

					}).on('mouseleave', function(event) {
						var selector = $(this).data('highlight');
						var $target = $(selector);
						$target.removeClass('selected');

					});
				});
			},

			on_show_tab_icon: function() {
				if (g_vars.tab_icon == 'empty') {
					$("img.dice-tab-icon").add($(".row-tab-icon")).hide();
				}
				this.$container.on("change", "input[name=show_tab_icon]", function() {
					var is_checked = $(this).prop("checked");
					if (is_checked) {
						fn.home.$preview.removeClass("hide-tab-icon");
						fn.nav.$preview.find(".highlight-icon-color").css("opacity", 1);
						$("#item_tab_icon_color").slideDown();
						$("img.dice-tab-icon").css("display", "block");
						$(".row-tab-icon").css("display", "inline");
					} else {
						fn.home.$preview.addClass("hide-tab-icon");
						fn.nav.$preview.find(".highlight-icon-color").css("opacity", 0);
						$("#item_tab_icon_color").slideUp();
						$("img.dice-tab-icon").css("display", "none");
						$(".row-tab-icon").css("display", "none");
					}
				});
			},

			init_colorpickers: function() {

				// Navigation Buttons - Tab text color picker
				biz.init_colorpicker({
					object: $(".color-picker-icon-color"),
					afterChange: function(hsb, hex, rgb, el) {
						fn.nav.updateIconColorPreview();
						fn.nav.updateIconColorForWhite();
					},

					afterSubmit: function(hsb, hex, rgb, el) {
						fn.nav.updateIconColorPreview();
						fn.nav.updateIconColorForWhite();
					}

				});
			},

			init_flyups: function() {
				// Icon Background ( = Tab Button)
				$(".tab-button-picker").flyup({
					name: "tab_button",
					rows: 3,
					devices: ["all"],
					dimension: {
						all: g_vars.dimensions.tab_button.all.thumb
					},
					list: {
						all: g_vars.tab_button
					},
					elements: {
						all: fn.nav.$ele.tab_button
					},
					noImageAllRows: true,
					/* Dec 8, 2015 - Austin */
					industries: g_vars.tab_button_industry_options,

					onBeforeSlide: function() {
						fn.nav.resetTabButton(this.$flyup);

						this.toggleTab();
						this.backup_flyup_data();
						this.enableSaveButton(false);
					},

					onShow: function() {
						fn.common.hide_applause_popup();
					},

					onSelect: function(device, $block) {

						var url;
						var $actvieBlock = this.getActiveBlock();

						//CV-487 we should preview realURL as previewer is bigger than flyup image.
						url = $block.data("realUrl");

						fn.nav.$preview.find("img.preview.tab-button").add(".default-theme .dice-tab-bg").attr({
							src: url
						});

						fn.nav.updateTabButtonCss();

						// CV-487 , In order to add Canvas in flyup
						this.$flyup.find("canvas").remove();
						if ($block.find("canvas").length == 0) {
							if ($block.data("id") == "g_no_image") {
								$block.find("a.select-item").append('<canvas class = "canvas-no-image-tab-button-flyup" />');
							} else {
								$block.find("a.select-item").append('<canvas class = "canvas-tab-button-flyup" />');
							}
						}

						if (typeof $actvieBlock != "undefined" && $actvieBlock.length == 1) {
							fn.nav.updateTabButtonFlyupCanvas($actvieBlock, this.$flyup);
						}

						if ($actvieBlock.data("id") == "g_no_image") {

							fn.nav.updateIconColorForWhite();
						}

					},

					onCancel: function() {
						fn.nav.resetTabButton(this.$flyup);
						$(".highlight-icon-bg").removeClass("selected");
					},

					onSave: function() {
						var image_overlay_color = this.$flyup.find("#tab_tint_flyup").val();
						var image_overlay_opacity = this.$flyup.find("#range_tab_tint_opacity").val();

						$("#tab_tint").val(image_overlay_color);
						$("#tab_tint_opacity").val(image_overlay_opacity);

						//Preview tab icon with selected tab button back.
						$(".highlight-icon-bg").removeClass("selected");

						fn.nav.updateIconColorForWhite();
					},

					onHidden: function() {
						fn.common.check_changed();
					}

				});

				$(".flyup-tab_button").on("change", "#range_tab_tint_opacity", function() {

					fn.nav.updateTabButtonCss();
					fn.nav.updateIconColorForWhite();
					fn.nav.updateTabButtonFlyupCanvas($(this).closest(".flyup").find(".block.active"), $(this).closest(".flyup"));

				}).on("change", "#tab_tint_flyup", function() {

					fn.nav.updateIconColorForWhite();
					fn.nav.updateTabButtonFlyupCanvas($(this).closest(".flyup").find(".block.active"), $(this).closest(".flyup"));
				});

			},

			bind_init_events: function() {

				var is_checked = $("input[name=tab_showtext]", fn.nav.$container).prop("checked");

				if (is_checked) {
					fn.home.$preview.removeClass("hide-tab-label");
					fn.nav.$container.find(".highlight-icon-text").removeClass("hide highlight-hidden");
					$("#item_tab_text").slideDown();
				} else {
					fn.home.$preview.addClass("hide-tab-label");
					fn.nav.$container.find(".highlight-icon-text").addClass("hide");
					$("#item_tab_text").slideUp();
				}
			},

			init: function() {
				this.$container = $("#nav_buttons_section");
				this.$preview = this.$container.find(".setting-preview");

				this.on_tab_showtext();
				this.on_show_tab_icon();
				this.bind_init_events();
				this.init_colorpickers();
				this.init_flyups();

				fn.nav.updateIconColorPreview();
				fn.nav.updateIconColorForWhite();
				fn.nav.updateTabButtonCss();
				fn.nav.updateTabButtonTextForWhite();
				fn.nav.updateTabButtonText($("#tab_text", fn.nav.$container).val());
			}
		},

		// Screen Styling
		global: {

			$container: false,
			$preview: false,
			$ele: {
				header: $("input[name=global_header]"),
				bg: {
					phone: $("input[name=global_bg_phone]"),
					tablet: $("input[name=global_bg_tablet]")
				}
			},

			resetHeader: function($flyup) {
				var image_overlay_color = $("#global_header_tint").val();
				var image_overlay_opacity = $("#global_header_tint_opacity").val();

				$flyup.find("#range_global_header_tint_opacity").val(image_overlay_opacity).rangeslider("update", true);
			},

			updateHeaderCss: function() {
				var $flyup = $(".flyup-global_header");
				var $preview = $(".highlight-ss-header-bg", fn.global.$preview);
				var $style = $("style#css_global_header");

				$preview.find(".overlay").css("background-color", "").css("opacity", "");

				var opacity = $flyup.find("#range_global_header_tint_opacity").val() / 100.0;
				var bgColor = $("#global_header_tint", this.$container).val();
				var dim = g_vars.dimensions.header.all.thumb;

				var strCss =
					".flyup-global_header .block.active a.select-item:before {" + "width: " + dim.width + "px;" + "height: " + dim.height + "px;" + "background-color: #" + bgColor + ";" + "opacity: " + opacity + ";" + "}" + ".highlight-ss-header-bg div.overlay {" + "background-color: #" + bgColor + ";" + "opacity: " + opacity + ";" + "}";
				$style.html(strCss);

				fn.global.$preview.find(".highlight-ss-header-toolbar-screen .sdiv.header-contact").css('opacity', opacity);
			},

			updateBackgroundColor: function() {
				var bg_color = $("#global_bg_color_flyup").val();
				var is_blur = $("input[name=flyup_blur_global_v2]").prop("checked");

				if ($(".global-bg-picker").data("jflyup").getActiveDevice() != "tablet") {

					$(".highlight-ss-screen-bg .inner").css({
						"background-color": "#" + bg_color,
					});
				}

				if ($(".global-bg-picker").data("jflyup").getActiveBlock().data("id") == "g_no_image") {
					$(".global-bg-picker").data("jflyup").getActiveBlock().find("img").hide();
				} else {
					$(".global-bg-picker").data("jflyup").$flyup.find(".block-g_no_image img").show();
				}
				$(".global-bg-picker").data("jflyup").$flyup.find(".block a.select-item").css("background-color", "initial");
				$(".global-bg-picker").data("jflyup").getActiveBlock().find("a.select-item").css("background-color", "#" + bg_color);

				if ($(".global-bg-picker").data("jflyup").getActiveDevice() != "tablet") {
					fn.global.$preview.find(".highlight-ss-screen-bg .inner").toggleClass("blur", is_blur);
				}
				$(".global-bg-picker").data("jflyup").getActiveBlock().toggleClass("blur", is_blur);
			},

			resetScreenBackground: function($flyup) {
				var global_bg_color = $("#global_bg_color").val();
				$flyup.find("#color_picker_global_bg").colpickSetColor(global_bg_color);

				var blur_global_v2 = $("#blur_global_v2").val();
				$flyup.find("#togglebox_blur_global_v2").toggleboxSet(blur_global_v2);
			},

			init_colorpickers: function() {
				fn.global.$container.on("change", "#sel_tab_font", function() {
					fn.global.$preview.find('*').css("font-family", $(this).val());
				});

				biz.init_selectbox({
					selector: "#sel_tab_font",
					templateResult: function(data) {
						if (!data.id)
							return data.text;
						var $option = $('<span style="font-family:' + data.text + '">' + data.text + '</span>');
						return $option;
					}
				});

				// Header Text
				biz.init_colorpicker({
					object: fn.global.$container.find('.color-picker-nav-text'),
					afterChange: function(hsb, hex, rgb, el) {
						fn.global.$preview.find("span.header-title-inner").css('color', '#' + hex);
						fn.global.$preview.find(".highlight-ss-header-toolbar-screen span").css('color', '#' + hex);
						fn.global.$preview.find(".highlight-ss-header-toolbar-screen .banner-part img").each(function() {
							var $img = $(this);
							var original = $img.data("original");
							var url = "";
							url = "/global/svg.php?filename=" + original + "&color=" + hex;

							$img.attr("src", url);

						});
					},
					afterSubmit: function(hsb, hex, rgb, el) {
						fn.global.$preview.find("span.header-title-inner").css('color', '#' + hex);
						fn.global.$preview.find(".highlight-ss-header-toolbar-screen span").css('color', '#' + hex);
						fn.global.$preview.find(".highlight-ss-header-toolbar-screen .banner-part img").each(function() {
							var $img = $(this);
							var original = $img.data("original");
							var url = "";
							url = "/global/svg.php?filename=" + original + "&color=" + hex;

							$img.attr("src", url);

						});
					}
				});

				// Header Text Shadow
				biz.init_colorpicker({
					object: fn.global.$container.find('.color-picker-nav-text-alt'),
					afterChange: function(hsb, hex, rgb, el) {
						fn.global.$preview.find("span.header-title-inner").css('text-shadow', '#' + hex + ' 1px 1px 0');
						fn.global.$preview.find(".highlight-ss-header-toolbar-screen span.sheader").css('text-shadow', '#' + hex + ' 1px 1px 0');
					},

					afterSubmit: function(hsb, hex, rgb, el) {
						fn.global.$preview.find("span.header-title-inner").css('text-shadow', '#' + hex + ' 1px 1px 0');
						fn.global.$preview.find(".highlight-ss-header-toolbar-screen span.sheader").css('text-shadow', '#' + hex + ' 1px 1px 0');
					}
				});

				// Jul 13, 2016 - Austin
				// Text Color - Preview as "Mortgage"
				biz.init_colorpicker({
					object: fn.global.$container.find('.color-picker-feature-text'),
					afterChange: function(hsb, hex, rgb, el) {
						fn.global.$preview.find(".highlight-ss-text-screen span.slabel").css('color', '#' + hex);
					},
					afterSubmit: function(hsb, hex, rgb, el) {
						fn.global.$preview.find(".highlight-ss-text-screen span.slabel").css('color', '#' + hex);
					}
				});

				// Header and Toolbar background Color CV-2922 # preview - contact
				biz.init_colorpicker({
					object: fn.global.$container.find('.color-picker-header-tint'),
					afterChange: function(hsb, hex, rgb, el) {
						fn.global.$preview.find(".highlight-ss-header-toolbar-screen .sdiv").css('background-color', '#' + hex);
						fn.global.$preview.find(".highlight-ss-header-bg div.overlay").css('background-color', '#' + hex);
					},
					afterSubmit: function(hsb, hex, rgb, el) {
						fn.global.$preview.find(".highlight-ss-header-toolbar-screen .sdiv").css('background-color', '#' + hex);
						fn.global.$preview.find(".highlight-ss-header-bg div.overlay").css('background-color', '#' + hex);
					}
				});

				// Section => Bar
				biz.init_colorpicker({
					object: fn.global.$container.find('.color-picker-section-bar'),
					afterChange: function(hsb, hex, rgb, el) {
						fn.global.$preview.find(".highlight-section-name").css('background-color', '#' + hex);
					},

					afterSubmit: function(hsb, hex, rgb, el) {
						fn.global.$preview.find(".highlight-section-name").css('background-color', '#' + hex);
					}
				});

				// Section => Text
				biz.init_colorpicker({
					object: fn.global.$container.find('.color-picker-section-text'),
					afterChange: function(hsb, hex, rgb, el) {
						fn.global.$preview.find(".highlight-section-name span.title").css('color', '#' + hex);
					},
					afterSubmit: function(hsb, hex, rgb, el) {
						fn.global.$preview.find(".highlight-section-name span.title").css('color', '#' + hex);
					}
				});

				// Odd Rows => Bar
				biz.init_colorpicker({
					object: fn.global.$container.find('.color-picker-odd-bar'),
					afterChange: function(hsb, hex, rgb, el) {
						fn.global.$preview.find(".highlight-odd-row").css('background-color', '#' + hex);
					},

					afterSubmit: function(hsb, hex, rgb, el) {
						fn.global.$preview.find(".highlight-odd-row").css('background-color', '#' + hex);
					}
				});

				// Odd Rows => Text
				biz.init_colorpicker({
					object: fn.global.$container.find('.color-picker-odd-text'),
					afterChange: function(hsb, hex, rgb, el) {
						fn.global.$preview.find(".highlight-odd-row span.title").css('color', '#' + hex);
					},

					afterSubmit: function(hsb, hex, rgb, el) {
						fn.global.$preview.find(".highlight-odd-row span.title").css('color', '#' + hex);
					}
				});

				// Even Rows => Bar
				biz.init_colorpicker({
					object: fn.global.$container.find('.color-picker-even-bar'),
					afterChange: function(hsb, hex, rgb, el) {
						fn.global.$preview.find(".highlight-even-row").css('background-color', '#' + hex);
					},

					afterSubmit: function(hsb, hex, rgb, el) {
						fn.global.$preview.find(".highlight-even-row").css('background-color', '#' + hex);
					}
				});

				// Even Rows => Text
				biz.init_colorpicker({
					object: fn.global.$container.find('.color-picker-even-text'),
					afterChange: function(hsb, hex, rgb, el) {
						fn.global.$preview.find(".highlight-even-row span.title").css('color', '#' + hex);
					},

					afterSubmit: function(hsb, hex, rgb, el) {
						fn.global.$preview.find(".highlight-even-row span.title").css('color', '#' + hex);
					}
				});

				// Button Text Color
				biz.init_colorpicker({
					object: fn.global.$container.find('.color-picker-feature-button'),
					afterChange: function(hsb, hex, rgb, el) {
						fn.global.$preview.find(".ss-btn").css('color', '#' + hex);

						var buttonBgColor = $("#navbar_bg").val();
						fn.home.updateAddiButtonCss(hex, buttonBgColor);
					},
					afterSubmit: function(hsb, hex, rgb, el) {
						fn.global.$preview.find(".ss-btn").css('color', '#' + hex);

						var buttonBgColor = $("#navbar_bg").val();
						fn.home.updateAddiButtonCss(hex, buttonBgColor);
					}
				});

				// Button Background Color
				biz.init_colorpicker({
					object: fn.global.$container.find('.color-picker-navbar-bg'),
					afterChange: function(hsb, hex, rgb, el) {
						// Home Screen Widget - Message, Music, Share, Bar icon
						var $selector = fn.home.$preview.find(".bar-icon").add(fn.home.$preview.find(".highlight-home-screen-widgets img"));
						$selector.each(function() {
							if (typeof $(this) == "undefined") return false;

							var src = $(this).attr("src").split("color=")[0];

							src += "color=" + hex;
							$(this).attr("src", src);
						});

						// Login Button
						var buttonTextColor = $("#feature_button").val();
						fn.home.updateAddiButtonCss(buttonTextColor, hex);

						fn.global.$preview.find(".ss-btn").css('background-color', '#' + hex);
					},
					afterSubmit: function(hsb, hex, rgb, el) {
						// Home Screen Widget - Message, Music, Share, Bar icon
						var $selector = fn.home.$preview.find(".bar-icon").add(fn.home.$preview.find(".highlight-home-screen-widgets img"));
						$selector.each(function() {
							if (typeof $(this) == "undefined") return false;
							
							var src = $(this).attr("src").split("color=")[0];

							src += "color=" + hex;
							$(this).attr("src", src);
						});

						// Login Button
						var buttonTextColor = $("#feature_button").val();

						fn.home.updateAddiButtonCss(buttonTextColor, hex);
						fn.global.$preview.find(".ss-btn").css('background-color', '#' + hex);
					}
				});
			},

			/** Austin - 2016.7.11 
			 *
			 * CV-2825 - Design: Color Schemes Improvements
			 * Add color palette preview for each color scheme within the dropdown
			 *
			 */
			init_select_color_theme: function() {
				// Prepare array of options
				var data = [];
				fn.global.scheme_colors = {};
				$.each(g_vars.color_themes, function(index, obj) {
					data.push({
						id: index,
						text: obj.name
					});

					fn.global.scheme_colors[index] = obj.colors;
				});

				biz.init_selectbox({
					selector: "select.select2-color-theme",
					containerCssClass: "color-theme",
					minimumResultsForSearch: 6,
					data: data,
					templateResult: function(data) {
						if (!data.id) {
							return data.text;
						}

						var optionHTML = '';
						optionHTML += '<div class="color-theme-option clearfix">';
						optionHTML += '<span class="name">' + data.text + '</span>';
						optionHTML += '<span class="wrp">';
						optionHTML += '<span class="color-palette">';

						var colors = fn.global.scheme_colors;
						var i = 0;
						for (var name in colors[data.id]) {
							optionHTML += '<span style="background-color: #' + colors[data.id][name] + '"></span>';
							i++;
							if (i > 4) {
								break;
							}
						}

						optionHTML += '</span>';
						optionHTML += '</span>';
						optionHTML += '</div>';

						return $(optionHTML);
					}
				});

				// tooltip
				$("button.btn-lib-color-theme").tooltip({
					template: '<div class="tooltip tooltip-color-theme" role="tooltip"><div class="tooltip-arrow"></div><div class="tooltip-inner" style="text-align: center"></div></div>',
					placement: "bottom"
				});
			},

			updateColorTheme: function(theme) {
				if (!theme) {
					return false;
				}

				// Set colors of color pickers
				fn.global.$container
					.find("#color_picker_section_bar").colpickSetColor(theme.section_bar).end()
					.find("#color_picker_section_text").colpickSetColor(theme.section_text).end()
					.find("#color_picker_oddrow_bar").colpickSetColor(theme.oddrow_bar).end()
					.find("#color_picker_oddrow_text").colpickSetColor(theme.oddrow_text).end()
					.find("#color_picker_evenrow_bar").colpickSetColor(theme.evenrow_bar).end()
					.find("#color_picker_evenrow_text").colpickSetColor(theme.evenrow_text).end()
					// Header Text
					.find("#color_picker_nav_text").colpickSetColor(theme.nav_text).end()
					// Header Text Shadow
					.find("#color_picker_nav_text_alt").colpickSetColor(theme.nav_text_alt).end()
					// Text Color
					.find("#color_picker_feature_text").colpickSetColor(theme.feature_text).end()
					// Global Header Color
					.find("#color_picker_global_header_tint").colpickSetColor(theme.global_header_tint).end();
				for (var name in theme) {
					$("input[name=" + name + "]").val(theme[name]);
				}

				fn.global.$preview
					.find("span.header-title-inner").css({
						'color': '#' + theme.nav_text,
						'text-shadow': '#' + theme.nav_text_alt + ' 1px 1px 0'
					}).end()
					.find(".highlight-section-name").css('background-color', '#' + theme.section_bar).end()
					.find(".highlight-section-name span.title").css('color', '#' + theme.section_text).end()
					.find(".highlight-odd-row").css('background-color', '#' + theme.oddrow_bar).end()
					.find(".highlight-odd-row span.title").css('color', '#' + theme.oddrow_text).end()
					.find(".highlight-even-row").css('background-color', '#' + theme.evenrow_bar).end()
					.find(".highlight-even-row span.title").css('color', '#' + theme.evenrow_text).end()
					.find(".highlight-ss-text-section span.slabel").css('color', '#' + theme.feature_text).end()
					.find(".highlight-ss-header-toolbar-screen .sdiv").css('background-color', '#' + theme.global_header_tint).end()
					.find(".highlight-ss-header-bg div.overlay").css('background-color', '#' + theme.global_header_tint).end();
			},

			/* Jul 11, 2016 - Austin */
			toggleColorTheme: function(strType) {
				// strType: lib | custom
				if (strType == 'lib') {
					// toggle to Library theme
					$(".list-color-scheme .custom-only").fadeOut();
					$(".list-color-scheme .lib-only").fadeIn();

					fn.global.$container.find(".row-custom-only").slideUp();

					setTimeout(function() {
						fn.global.$container.removeClass('scustom').addClass('slib');
					}, 800);

					$("#sel_color_theme").prop('disabled', false);

					// backup current Custom theme
					var theme = {};
					fn.global.$container.find(".color-picker").each(function() {
						var ref = $(this).data('ref');
						if (!ref) {
							return true;
						}

						theme[ref] = $(this).prev().val();
					});

					fn.global.custom_theme = theme;

					// revert Library theme
					var id = $("#sel_color_theme").val();
					fn.global.updateColorTheme(g_vars.color_themes[id]);

					$("input[name=color_theme_is_custom]").val(0);
				} else {
					$(".list-color-scheme .lib-only").fadeOut();
					$(".list-color-scheme .custom-only").fadeIn();

					fn.global.$container.find(".row-custom-only").slideDown();

					// Toggle to Custom theme
					setTimeout(function() {
						fn.global.$container.removeClass('slib').addClass('scustom');
					}, 800);

					$("#sel_color_theme").prop('disabled', true);

					// revert Custom theme
					if (typeof fn.global.custom_theme !== 'undefined') {
						fn.global.updateColorTheme(fn.global.custom_theme);
					}

					$("input[name=color_theme_is_custom]").val(1);
				}

				fn.common.check_changed();
			},

			on_change_color_theme: function() {
				this.$container.on("change", "select[name=color_theme]", function() {
					var id = $(this).val();
					if (typeof g_vars.color_themes[id] == "undefined") {
						return false;
					}

					fn.global.updateColorTheme(g_vars.color_themes[id]);
				});
			},

			/* toggle between lib | custom color theme */
			on_toggle_color_theme: function() {
				$("a.color-theme-choose-custom").click(function() {
					// Go to custom
					fn.global.toggleColorTheme('custom');
				});

				$("button.btn-lib-color-theme").click(function() {
					// Go to library color theme
					fn.global.toggleColorTheme('lib');
				});
			},

			initHeaderTextShadow: function() {
				var hex = $("#nav_text_alt", fn.global.$container).val();
				fn.global.$preview.find("span.header-title-inner").css('text-shadow', '#' + hex + ' 1px 1px 0');
			},

			init_flyups: function() {
				// Global header background
				$(".global-header-picker").flyup({
					name: "global_header",
					rows: 3,
					devices: ["all"],
					dimension: {
						all: g_vars.dimensions.header.all.thumb
					},
					list: {
						all: g_vars.global_header
					},
					elements: {
						all: fn.global.$ele.header
					},
					industries: g_vars.header_industry_options,

					onBeforeSlide: function() {

						//Select No-image block for upexpected case
						var $preview = $(".highlight-ss-header-bg");
						if ($preview.hasClass("no_image")) {
							this.$flyup.find(".block-g_no_image").addClass("selected").addClass("active");
						}

						this.toggleTab($("#global_header").data("filename"));

						fn.global.updateHeaderCss();
						fn.global.resetHeader(this.$flyup);
						fn.common.hide_applause_popup();

						this.toggle_noImageSection();
						this.backup_flyup_data();
						this.enableSaveButton(false);

					},

					onSelect: function(device, $block) {

						var url;
						var $preview = $(".highlight-ss-header-bg");

						if ($block.data("id") != "g_no_image") {
							url = $block.data("url");
						} else {
							url = $block.data("realUrl");
						}

						$preview.toggleClass("no_image", $block.hasClass("block-g_no_image"));
						$preview.find("img.preview").attr({
							src: url
						});

						fn.global.updateHeaderCss();

						this.toggle_noImageSection();
					},

					onHide: function() {
						$(".highlight-ss-header-bg").removeClass("selected");
					},

					onCancel: function() {

						var $preview = $(".highlight-ss-header-bg");

						if (g_vars.global_header.active.id == "g_no_header") {

							//Remove other Active block for upexpected case
							this.$flyup.find(".body-device .active").removeClass("active");
							this.$flyup.find(".block-g_no_image").addClass("selected").addClass("active");

							$preview.addClass("no_image");
							$preview.find("img.preview").attr({
								src: g_vars.global_header.active.real_url
							});
						}

						fn.global.resetHeader(this.$flyup);
						fn.common.init_checkNoheader();
					},

					onSave: function() {

						var image_overlay_opacity = this.$flyup.find("#range_global_header_tint_opacity").val();

						$("#global_header_tint_opacity").val(image_overlay_opacity);
					},

					onHidden: function() {
						fn.common.check_changed();
					}
				});

				$(".flyup-global_header").on("change", "#range_global_header_tint_opacity", function(e) {
					fn.global.updateHeaderCss();
				}).on("uploaded.flyup", function(e, data) {
					$(".home-header-picker").flyup("reload", data.device);
				}).on("deleted.flyup", function(event, data) {
					$(".home-header-picker").flyup("reload", data.device);
				});

				// Global Screen Background
				var bg_dim = g_vars.dimensions.bg;
				$(".global-bg-picker").flyup({
					name: "global_bg",
					category: "bg",
					rows: 1,
					devices: ["phone", "tablet"],
					dimension: {
						phone: bg_dim.phone.thumb,
						tablet: bg_dim.tablet.thumb
					},
					list: {
						phone: {
							//default: g_vars.bg.default.phone,
							no_image: g_vars.bg.no_image.phone,
							lib: g_vars.bg.lib.phone,
							active: g_vars.global_bg.phone.active,
							custom: g_vars.bg.custom.phone
						},
						tablet: {
							//default: g_vars.bg.default.tablet,
							no_image: g_vars.bg.no_image.tablet,
							lib: g_vars.bg.lib.tablet,
							active: g_vars.global_bg.tablet.active,
							custom: g_vars.bg.custom.tablet
						},
					},
					elements: {
						phone: fn.global.$ele.bg.phone,
						tablet: fn.global.$ele.bg.tablet,
					},

					industries: g_vars.bg_industries,

					onBeforeSlide: function() {
						//this.toggleTab4ActiveDevice();
						var blur_global_v2 = parseInt($("input[name=blur_global_v2]").val()); // 1 or 0
						this.$flyup.find("#togglebox_blur_global_v2").toggleboxSet(blur_global_v2);

						this.backup_flyup_data();
						this.enableSaveButton(false);
						fn.common.hide_applause_popup();
					},

					onHide: function() {
						$(".highlight-ss-screen-bg").removeClass("selected");
					},

					onCancel: function() {
						fn.global.resetScreenBackground(this.$flyup);
					},

					onSave: function() {
						var global_bg_color = this.$flyup.find("#global_bg_color_flyup").val();
						$("#global_bg_color").val(global_bg_color);

						var blur_global_v2 = (this.$flyup.find("input[name=flyup_blur_global_v2]").prop("checked")) ? 1 : 0;
						$("#blur_global_v2").val(blur_global_v2);

						var $block = this.getActiveBlock("phone");
						if ($block && $block.length > 0) {
							var url;
							if ($block.hasClass("no-image")) {
								url = $block.data("realUrl");
							} else {
								url = $block.data("url");
							}
							$(".highlight-ss-screen-bg .inner").css({
								"background-image": "url(" + url + ")"
							});
						}
					},

					render: function(device, $block) {

						if ($block && $block.length > 0) {
							var url;
							if ($block.hasClass("no-image")) {
								url = $block.data("realUrl");
							} else {
								url = $block.data("url");
							}

							if (device != "tablet") {

								$(".highlight-ss-screen-bg .inner").css({
									"background-image": "url(" + url + ")"
								});

							}

							fn.global.updateBackgroundColor();
						}

					},

					onHidden: function() {
						fn.common.check_changed();
					}
				});

				$(".flyup-global_bg").on("change", "input[name=flyup_blur_global_v2]", function() {

					fn.global.updateBackgroundColor();

				});
			},

			checkBuildToDesign: function() {
				var build_to_design = $.cookie("build_to_design");

				if (parseInt(build_to_design) == 1) {
					setTimeout(function() {
						$(".glow-nav li[data-target=#nav_buttons_section]").trigger("click");
					}, 500);

				}
				$.cookie("build_to_design", "");
			},

			init: function() {

				this.$container = $("#screen_styling_section");
				this.$preview = this.$container.find(".setting-preview");

				biz.initGlow();

				this.init_colorpickers();
				this.init_select_color_theme();
				this.on_change_color_theme();
				this.on_toggle_color_theme();
				this.init_flyups();
				this.initHeaderTextShadow();

				this.checkBuildToDesign();

			}
		},

		// Help Info
		helpInfo: {
			$onboarding_tutorial_wrapper: null,
			$tutorial_tips_wrapper: null,
			$design_app_for_me_modal: null,
			$tip_home_screen: null,
			$tip_feature_styling: null,
			$tip_save_changes: null,
			$tip_preview_changes: null,

			$dot_home_screen: null,
			$dot_feature_styling: null,
			$dot_save_changes: null,
			$dot_preview_changes: null,

			$modal_image: null,

			/* Elements for Dropdown Menu */
			$onboarding_design_btn: null,

			/* Elements for Onboarding Tutorial */
			$skip_btn: null,
			$take_tour_btn: null,
			$next_tip_btn: null,
			$prev_tip_btn: null,
			$exit_tip_btn: null,

			first_visit: '1',
			second_visit: '1',
			tutorial_done: '0',
			/* Array for Step Names */
			step_names: [
				'Home Screen',
				'Feature Styling',
				'Save your changes',
				'Preview your changes'
			],

			/* Actions */
			init: function() {
				fn.helpInfo.$onboarding_tutorial_wrapper = $("#onboarding_tutorial_wrapper");
				fn.helpInfo.$tutorial_tips_wrapper = fn.helpInfo.$onboarding_tutorial_wrapper.find(".design-tips-wrapper");
				fn.helpInfo.$design_app_for_me_wrapper = $("#design_app_for_me_wrapper");

				fn.helpInfo.$tip_home_screen = fn.helpInfo.$tutorial_tips_wrapper.find(".tip-home-screen");
				fn.helpInfo.$tip_feature_styling = fn.helpInfo.$tutorial_tips_wrapper.find(".tip-feature-styling");
				fn.helpInfo.$tip_save_changes = fn.helpInfo.$tutorial_tips_wrapper.find(".tip-save-changes");
				fn.helpInfo.$tip_preview_changes = fn.helpInfo.$tutorial_tips_wrapper.find(".tip-preview-changes");

				fn.helpInfo.$dot_home_screen = fn.helpInfo.$tutorial_tips_wrapper.find(".dot-home-screen");
				fn.helpInfo.$dot_feature_styling = fn.helpInfo.$tutorial_tips_wrapper.find(".dot-feature-styling");
				fn.helpInfo.$dot_save_changes = fn.helpInfo.$tutorial_tips_wrapper.find(".dot-save-changes");
				fn.helpInfo.$dot_preview_changes = fn.helpInfo.$tutorial_tips_wrapper.find(".dot-preview-changes");

				fn.helpInfo.$btn_design_app_hire = fn.helpInfo.$design_app_for_me_wrapper.find(".btn-design-for-me");
				fn.helpInfo.$btn_design_app_continue = fn.helpInfo.$design_app_for_me_wrapper.find(".btn-continue");

				fn.helpInfo.$modal_image = $("#modal_design_tutorial .modal-header .img-sub-container");

				fn.helpInfo.$onboarding_design_btn = $('.page-header .design-help-info .help-info-dropdown .dropdown-menu li a.help-info-onboarding');
				fn.helpInfo.$design_app_for_me_btn = $('.page-header .design-help-info .help-info-dropdown .dropdown-menu li a.help-info-design-app');

				fn.helpInfo.$skip_btn = fn.helpInfo.$onboarding_tutorial_wrapper.find(".btn-skip");
				fn.helpInfo.$take_tour_btn = $('#modal_design_tutorial').find(".btn-take-tour");

				/* Tip Actions */
				fn.helpInfo.$next_tip_btn = fn.helpInfo.$tutorial_tips_wrapper.find(".btn-next");
				fn.helpInfo.$prev_tip_btn = fn.helpInfo.$tutorial_tips_wrapper.find(".btn-prev");
				fn.helpInfo.$exit_tip_btn = fn.helpInfo.$tutorial_tips_wrapper.find(".btn-exit");

				// Live Chat Init
				window.app_previewer.contact_menu.init();

				fn.helpInfo.initModals();

				// This is to check if it's the first visit or second visit, if first->'Onboarding' modal, second->'Design App for me' Modal..
				fn.helpInfo.checkFirst_Second_visit();

				$(window).on('resize', function() {
					fn.helpInfo.adjustTipPosition();
					fn.helpInfo.adjustDesignWrapperPosition();
				});

				fn.helpInfo.$skip_btn.on('click', function() {
					setTimeout(function() {
						fn.helpInfo.tutorial_done = '1';
					}, 50);
				});

				fn.helpInfo.$btn_design_app_hire.on('click', function(e) {
					var self = this;
					if (!fn.helpInfo.$design_app_for_me_wrapper.hasClass('disappear')) {
						setTimeout(function() {
							$(self).trigger('click');
						}, 1000);

						e.stopImmediatePropagation();

						fn.helpInfo.addTranslate();
						fn.helpInfo.$design_app_for_me_wrapper.addClass('disappear');
						return false;
					} else {
						setTimeout(function() {
							fn.helpInfo.removeTranslate();
							fn.helpInfo.$design_app_for_me_wrapper.removeClass('disappear').hide();
							fn.helpInfo.GATrack_Hire('DIFM Click', 'Design For Me');
						}, 200);

					}
				});

				Hire.init();

				fn.helpInfo.$btn_design_app_continue.on('click', function() {
					fn.helpInfo.addTranslate();
					fn.helpInfo.$design_app_for_me_wrapper.removeClass('appear');
					fn.helpInfo.$design_app_for_me_wrapper.addClass('disappear');
					setTimeout(function() {
						fn.helpInfo.removeTranslate();
						fn.helpInfo.$design_app_for_me_wrapper.hide();
					}, 1000);
					fn.helpInfo.GATrack_Hire('DIY Click', 'Continue');
				});

				$(".modal-hire-a-designer").on("hire.click.step4button", function() {
					fn.helpInfo.GATrack_Hire('DIFM Success', 'Submit');
				});

				fn.helpInfo.$take_tour_btn.on('click', function() {
					fn.helpInfo.$tutorial_tips_wrapper.show();
					fn.helpInfo.scrollContent("#home_screen_section", 1);
					fn.helpInfo.adjustTipPosition();
					fn.helpInfo.GATrack(fn.helpInfo.step_names[0]);
				});

				fn.helpInfo.initTipActions();
			},

			initModals: function() {

				fn.helpInfo.$onboarding_design_btn.off('click');
				fn.helpInfo.$onboarding_design_btn.on('click', function() {
					ajax.post('design.store_app_meta_tutorial', {}, function(json) {

					});
				});

				/* Bind modal for Design Onboarding Tutorial */
				fn.helpInfo.$modal_image.slideUp();
				fn.helpInfo.$onboarding_design_btn.bind_modal({
					modalId: 'modal_design_tutorial',
					onShown: function() {
						fn.helpInfo.$modal_image.slideDown();
						fn.helpInfo.GATrack('Landing Modal');
					},
					onHide: function() {
						fn.helpInfo.$modal_image.slideUp();
					}
				});

				fn.helpInfo.$design_app_for_me_btn.off('click');
				fn.helpInfo.$design_app_for_me_btn.on('click', function() {
					window.app_previewer.forceCollapse();
					fn.flyup.closeOtherFlyups();
					fn.helpInfo.$design_app_for_me_wrapper.show();
					fn.helpInfo.removeTranslate();
					fn.helpInfo.$design_app_for_me_wrapper.removeClass('disappear');
					fn.helpInfo.$design_app_for_me_wrapper.addClass('appear');
					fn.helpInfo.adjustDesignWrapperPosition();
				})

			},

			// Init Tip Actions
			initTipActions: function() {
				fn.helpInfo.$exit_tip_btn.on('click', function() {
					var _this = $(this);
					fn.helpInfo.$tutorial_tips_wrapper.hide();
					fn.helpInfo.$tutorial_tips_wrapper.find(".tutorial-tip").removeClass('appear disappear move');
					fn.helpInfo.$tutorial_tips_wrapper.find(".tutorial-dot").removeClass('move');
					setTimeout(function() {
						fn.helpInfo.tutorial_done = '1';
						if (_this.hasClass('btn-green')) {
							$('.previewer-devices ul li a[data-device="iphone"]').trigger('click');
							window.app_previewer.refresh();
						}
					}, 50);
				});

				fn.helpInfo.$next_tip_btn.on('click', function() {
					var curInd = parseInt($(this).closest(".tutorial-tip").attr("ref-id"));
					var nextInd = curInd + 1;

					fn.helpInfo.$tutorial_tips_wrapper.find(".tutorial-tip[ref-id=" + curInd + "]").removeClass('appear disappear');
					fn.helpInfo.$tutorial_tips_wrapper.find(".tutorial-tip[ref-id=" + curInd + "]").addClass('disappear');
					if (nextInd == 2) {
						fn.helpInfo.scrollContent("#screen_styling_section", nextInd);
					} else if (nextInd == 3) {
						fn.helpInfo.scrollContent("#home_screen_section", nextInd);
					} else {
						fn.helpInfo.$tutorial_tips_wrapper.find(".tutorial-tip[ref-id=" + nextInd + "]").removeClass('appear disappear');
						fn.helpInfo.$tutorial_tips_wrapper.find(".tutorial-tip[ref-id=" + nextInd + "]").addClass('appear');
					}
					fn.helpInfo.GATrack(fn.helpInfo.step_names[nextInd - 1]);
				});

				fn.helpInfo.$prev_tip_btn.on('click', function() {
					var curInd = parseInt($(this).closest(".tutorial-tip").attr("ref-id"));
					var prevInd = curInd - 1;

					fn.helpInfo.$tutorial_tips_wrapper.find(".tutorial-tip[ref-id=" + curInd + "]").removeClass('appear disappear');
					fn.helpInfo.$tutorial_tips_wrapper.find(".tutorial-tip[ref-id=" + curInd + "]").addClass('disappear');

					if (prevInd == 1) {
						fn.helpInfo.scrollContent("#home_screen_section", prevInd);
					} else if (prevInd == 2) {
						fn.helpInfo.scrollContent("#screen_styling_section", prevInd);
					} else {
						fn.helpInfo.$tutorial_tips_wrapper.find(".tutorial-tip[ref-id=" + prevInd + "]").removeClass('appear disappear');
						fn.helpInfo.$tutorial_tips_wrapper.find(".tutorial-tip[ref-id=" + prevInd + "]").addClass('appear');
					}
					fn.helpInfo.GATrack(fn.helpInfo.step_names[prevInd - 1]);
				});
			},

			scrollContent: function(id, ind) {
				var currentScrollTop = $(".content").scrollTop();

				var sectionTop = $(id).offset().top;
				var offsetHeight = biz.getOffsetHeight();

				var y = currentScrollTop + sectionTop - offsetHeight;
				$('.content').animate({
					scrollTop: y + "px"
				}, {
					duration: 1000,
					complete: function() {
						fn.helpInfo.$tutorial_tips_wrapper.find(".tutorial-tip[ref-id=" + ind + "]").removeClass('disappear');
						fn.helpInfo.$tutorial_tips_wrapper.find(".tutorial-tip[ref-id=" + ind + "]").addClass('appear');
					}
				});
			},

			addTranslate: function() {
				/* Exact Transform */
				var trans_offsetX = $('.design-help-info .help-info-dropdown').offset().left -
					fn.helpInfo.$design_app_for_me_wrapper.find('.content-wrapper').offset().left;
				trans_offsetX -= fn.helpInfo.$design_app_for_me_wrapper.find('.content-wrapper').outerWidth() / 2;
				trans_offsetX += $('.design-help-info .help-info-dropdown').outerWidth();
				var trans_offsetY = fn.helpInfo.$design_app_for_me_wrapper.find('.content-wrapper').offset().top -
					$('.design-help-info .help-info-dropdown').offset().top;
				trans_offsetY += fn.helpInfo.$design_app_for_me_wrapper.find('.content-wrapper').outerHeight() / 2;
				trans_offsetX += 'px';
				trans_offsetY += 'px';
				$hidingContent = fn.helpInfo.$design_app_for_me_wrapper.find('.content-wrapper');
				$hidingContent.css('-webkit-transform', 'translate(' + trans_offsetX + ', -' + trans_offsetY + ') scale(0)');
				$hidingContent.css('-moz-transform', 'translate(' + trans_offsetX + ', -' + trans_offsetY + ') scale(0)');
				$hidingContent.css('transform', 'translate(' + trans_offsetX + ', -' + trans_offsetY + ') scale(0)');

				// Change modal collapsing animation.
				/*var $button = $('.design-help-info .help-info-dropdown');
				var $container = fn.helpInfo.$design_app_for_me_wrapper;
				  
				var buttonHeight = $button.height();
				var buttonWidth = $button.width();
				
				var buttonOffset = $button.offset();
			    var containerOffset = $container.offset();
			    
			    var diffX = containerOffset.left - buttonOffset.left - buttonWidth*0.5;
			    var diffY = containerOffset.top - buttonOffset.top - buttonHeight*0.5;
				var origin = -diffX + 'px ' + -diffY + 'px';

				$container.css({
					transformOrigin: origin
				}).addClass('processing');*/

			},

			removeTranslate: function() {
				$hidingContent = fn.helpInfo.$design_app_for_me_wrapper.find('.content-wrapper');
				$hidingContent.css('-webkit-transform', 'none');
				$hidingContent.css('-moz-transform', 'none');
				$hidingContent.css('transform', 'none');
			},

			adjustTipPosition: function() {
				var pos = $(".content .page-body .icon-home").eq(0).offset();

				if (typeof pos == 'undefined')
					return;

				fn.helpInfo.$tip_home_screen.css("left", pos.left + 50);
				fn.helpInfo.$tip_home_screen.css("top", pos.top - 70);

				fn.helpInfo.$dot_home_screen.css("left", pos.left - 2);
				fn.helpInfo.$dot_home_screen.css("top", pos.top - 3);

				pos = $(".content .page-body .glow-nav .icon-double-rounded-rect").offset();

				if (typeof pos == 'undefined')
					return;

				fn.helpInfo.$tip_feature_styling.css("left", pos.left + 50);
				fn.helpInfo.$tip_feature_styling.css("top", pos.top - 73);

				fn.helpInfo.$dot_feature_styling.css("left", pos.left - 2);
				fn.helpInfo.$dot_feature_styling.css("top", pos.top - 3);

				pos = $(".page-header .btn-save").offset();

				if (typeof pos == 'undefined')
					return;

				fn.helpInfo.$tip_save_changes.css("left", pos.left - 370);
				fn.helpInfo.$tip_save_changes.css("top", pos.top - 65);

				fn.helpInfo.$dot_save_changes.css("left", pos.left + 40);
				fn.helpInfo.$dot_save_changes.css("top", pos.top + 4);

				pos = $(".previewer").offset();

				if (typeof pos == 'undefined')
					return;

				fn.helpInfo.$tip_preview_changes.css("left", pos.left - 400);
				fn.helpInfo.$tip_preview_changes.css("top", pos.top + 45);

				fn.helpInfo.$dot_preview_changes.css("left", pos.left + 10);
				fn.helpInfo.$dot_preview_changes.css("top", pos.top + 110);
			},

			adjustDesignWrapperPosition: function() {
				var height1 = fn.helpInfo.$design_app_for_me_wrapper.find('.content-wrapper').outerHeight();
				var height2 = $(window).height();
				var marginTop = 0;
				if (height2 > height1) {
					marginTop = (height2 - height1) / 2;
				}
				fn.helpInfo.$design_app_for_me_wrapper.find('.content-wrapper').css('margin-top', marginTop);
			},

			// This is to check if it's the first visit or second visit, if first->'Onboarding' modal, second->'Design App for me' Modal
			checkFirst_Second_visit: function() {

				if ($first_visit_tutorial == '1') {
					fn.helpInfo.tutorial_done = '0';
					fn.helpInfo.$onboarding_design_btn.trigger('click');
					// Hide the second visit modal.
					fn.helpInfo.$design_app_for_me_wrapper.modal('hide');
				} else {
					$first_visit_tutorial = '0';
				}

				if ($second_visit_design == '1') {
					fn.helpInfo.$design_app_for_me_btn.trigger('click');
				} else {
					$second_visit_design = '0';
					if ($first_visit_tutorial == '0' && location.hostname != 'local.ryanszot.com') {
						setTimeout(function() {
							window.app_previewer.forceExpand();
						}, 200);
					}
				}
			},

			/* Google Analytics*/
			GATrack: function(ga_step_name) {
				if (typeof ga == 'undefined') {
					return;
				}
				ga('set', '&uid', $.cookie('GA_UserId'));
				ga('newTracker.set', '&uid', $.cookie('GA_UserId'));
				ga('send', 'event', 'Walkthrough Tutorial', 'Design', ga_step_name, {
					nonInteraction: true
				});
				ga('newTracker.send', 'event', 'Walkthrough Tutorial', 'Design', ga_step_name, {
					nonInteraction: true
				});
			},
			GATrack_Hire: function(ga_action, ga_label) {
				ga('set', '&uid', $.cookie('GA_UserId'));
				ga('newTracker.set', '&uid', $.cookie('GA_UserId'));
				ga('send', 'event', 'DIFM Overlay', ga_action, ga_label);
				ga('newTracker.send', 'event', 'DIFM Overlay', ga_action, ga_label);
			}
		},

		// Bootstrap
		init: function() {
			var _this = this;

			ajax.post("design.load", {
				app_id: g_app_id
			}, function(json) {
				for (var key in json.industry_maps) {
					Flyup.prototype.setIndustryMap(key, json.industry_maps[key]);
				}

				['common', 'home', 'shortcut', 'global', 'nav'].forEach(function(ele) {
					fn[ele].init();
				});

				fn.common.afterInit();

				setTimeout(function() {
					fn.helpInfo.init();
				}, 1000);

				// Backup current values of all elements in order to detect user has changed any element
				// NOTE: If you clicked SAVE from any flyup, it will be regarded as you have made some changes
				fn.common.backup_form_data();
				fn.common.monitor_form();
				fn.common.enableSaveButton(false);

				setTimeout(function() {
					fn.common.$pageBody.completed();
				}, 100);

				// Scroll to feature styling section when page is loaded from publish checklist page.
				var scrolledSection = $.cookie('design.current_section');
				var $featureStyle = $('li[data-target="#screen_styling_section"]');

				if (scrolledSection) {
					$featureStyle.trigger('click');
					$.cookie('design.current_section', '');
				}
			});
		},
	};

	return fn;

});