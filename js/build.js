/***
 * build.js
 * 
 * @author Austin L <auslee986@gmail.com>
 * @version 1.0
 */

define(['jquery', 'plugin', 'ajax', 'notify', 'modal', 'dropzone', 'emoji', 'jquery-ui', 'flyup', 'facebook'/*, 'zoomer', 'turnbox', 'aniview'*/], function ($, plugin, ajax, notify, modal, Dropzone, emoji, $ui, Flyup) {

	console.log(['a', $phrases]);

    var fn = {
        phrasesBuild : {
            Browse : (typeof $phrases.global_btn_browse != 'undefined') ? $phrases.global_btn_browse : 'Browse',
            Content : (typeof $phrases.build_label_content != 'undefined') ? $phrases.build_label_content : 'Content',
            Model : (typeof $phrases.build_label_model != 'undefined') ? $phrases.build_label_model : 'Model',
            Comments : (typeof $phrases.build_label_comments != 'undefined') ? $phrases.build_label_comments : 'Comments',
            msgFileTooBig : (typeof $phrases.global_tip_file_too_big != 'undefined') ? $phrases.global_tip_file_too_big : 'File is too big ({{filesize}}MB). Max filesize: {{maxFilesize}}MB.',
            msgNoContentInCategory : (typeof $phrases.build_label_no_content_in_category != 'undefined') ? $phrases.build_label_no_content_in_category : 'There is no content in this category.',
            msgDragImage : (typeof $phrases.global_tip_drag_image != 'undefined') ? $phrases.global_tip_drag_image : 'Drag image here or',
            msgFieldRequired : (typeof $phrases.build_label_required_field != 'undefined') ? $phrases.build_label_required_field : 'This field is required',
            msgBeforeUnload : (typeof $phrases.build_label_before_unload != 'undefined') ? $phrases.build_label_before_unload : 'You have entered new data on this page. If you navigate away from this page without first saving your data, the changes will be lost.',
            build_cfm_changed_section : (typeof $phrases.build_cfm_changed_section != 'undefined') ? $phrases.build_cfm_changed_section : 'Changed Section',
            build_thumb_desc_mailinglist : (typeof $phrases.build_thumb_desc_mailinglist != 'undefined') ? $phrases.build_thumb_desc_mailinglist : 'Upload a custom thumbnail image. The Image will be rounded for you.',
            build_thumb_desc_rssfeed : (typeof $phrases.build_thumb_desc_rssfeed != 'undefined') ? $phrases.build_thumb_desc_rssfeed : 'Upload a custom thumbnail image. The default image will be used if nothing is changed.',
            build_cfm_changed_feature : (typeof $phrases.build_cfm_changed_feature != 'undefined') ? $phrases.build_cfm_changed_feature : 'Changed Feature'
        },

        pageId: 'build',
        timer: null,
        noTabIcon: siteUrl + '/images/theme_editor/no_button.png?v=' + version,
        scrapSteps: ['image', 'facebook', 'twitter', 'gplus', 'youtube', 'rss'],

        $pageBody: null,
        $pageHeader: null,
        $buildWizardBlock: null,
        $buildTabBlock: null,
        $buildTabBlockContent: null,

        isCustomDesignEnabled: function() {
        	if (is_wl && partner_theme.hidden_sections.indexOf('ebcd') != -1) {
        		return false;
        	}

        	return true;
        },

        isAddTabEnabled: function() {
            if ( !is_wl_release ) {
                return true;
            }

            if (partner_theme.hidden_sections.indexOf('eba') != -1) {
                return false;
            }

            return true;
        },

        /** Austin - Nov 10, 2015 - Get all data for a tab **/
        getTabData: function(tabId) {
            if (tabId > 0) {
                if (typeof fn.core.data.tabs[tabId] === "undefined") {
                    console.error("[build.js] fn.getTabData() - Invalid tabId: " + tabId);
                }
            }

            return fn.core.data.tabs[tabId];
        },

        /** Austin - Nov 10, 2015 - Set all data for a tab **/
        setTabData: function(tabId, tabData) {
            fn.core.data.tabs[tabId] = tabData;

            fn.setTabField(tabId, "old_icon", {
                iconColor: tabData.iconColor,
                iconKey: tabData.iconKey,
                iconUrl: tabData.iconUrl
            });
        },

        /** Austin - Nov 10, 2015 - Updates a field for a tab **/
        setTabField: function(tabId, field, value) {
            fn.core.data.tabs[tabId][field] = value;
        },

        /** Austin - Nov 10, 2015 - Set a field is changed or not for a tab **/
        setTabChanged: function(tabId, field, is_changed) {
            if (is_changed) {
                fn.core.data.tabs[tabId].changed[field] = is_changed;
            } else {
                delete fn.core.data.tabs[tabId].changed[field];
            }
        },

        /** Austin - Nov 10, 2015 - Remove all data for a tab **/
        removeTabData: function(tabId) {
            if (typeof fn.core.data.tabs[tabId] === "undefined") {
                console.error("[build.js] fn.removeTabData() - Invalid tabId: " + tabId);
            }

            delete fn.core.data.tabs[tabId];
        },


        /* Wizard */
        wizard: {
            $steps: null,
            $inputSiteUrl: null,
            $btnPullContent: null,
            $progressRing: null,
            $choices: null,

            init: function () {
                fn.wizard.$steps = fn.$buildWizardBlock.find('.steps .step');
                fn.wizard.$inPutSiteUrl = fn.$buildWizardBlock.find('.input-site-url');
                fn.wizard.$btnPullContent = fn.$buildWizardBlock.find('.btn-pull-content');
                fn.wizard.$progressRing = fn.$buildWizardBlock.find('.progress-ring');
                fn.wizard.$choices = fn.$buildWizardBlock.find('.choice-list > li');

                $(window).on('resize', fn.wizard.adjustHeight);
                fn.wizard.adjustHeight();
                fn.$buildWizardBlock.completed();

                // Bind pull content button.
                fn.wizard.$btnPullContent.on('click', fn.wizard.pullContent);

                // Bind site url input.
                fn.wizard.$inPutSiteUrl.on('keyup', fn.wizard.enablePullContent);

                // Bind finish button.
                fn.$buildWizardBlock.find('.btn-choice').on('click', fn.wizard.finish);

                // Bind skip link.
                fn.$buildWizardBlock.find('.skip').on('click', fn.wizard.skip);

                // Init animate dots.
                fn.wizard.animateDots(fn.wizard.$progressRing.find('.animate-dots'));
            },

            animateDots: function ($obj) {
                var $dotTemp = $obj.find('span.dots'),
                    maxDots = $dotTemp.html().length, $dots;

                if (!maxDots) {
                    maxDots = 3;
                }

                for (var idx = 0; idx < maxDots; idx++) {
                    $obj.append('<span class="dot active">.</span>');
                };
                $dots = $obj.find('span.dot');
                $dotTemp.remove();

                fn.timer = setInterval(function () {
                    var currDots = $dots.filter('.active').length;

                    if (currDots < maxDots) {
                        $dots.eq(currDots).addClass('active');
                    } else {
                        $dots.removeClass('active');
                    }
                }, 600);
            },

            adjustHeight: function () {
                var winHeight = $(window).height(),
                    offsetHeight = $('.navbar-header').outerHeight() + $('.page-header').outerHeight();

                fn.$buildWizardBlock.css('height', winHeight - offsetHeight);
            },

            skip: function (e) {
                e.preventDefault();
                fn.wizard.moveStep();
            },

            enablePullContent: function () {
                if ($(this).val()) {
                    fn.wizard.$btnPullContent.removeAttr('disabled');
                } else {
                    fn.wizard.$btnPullContent.attr('disabled', true);
                }
            },

            pullContent: function () {
                var url = fn.wizard.$inPutSiteUrl.val();

                // Pull the content from site.
                ajax.mock('build.pull_content', { // NOTICE TO REPLACE mock with post!
                    url: url
                }, function (json) {
                    if (!json.success) {
                        notify.error(json.msg);
                        fn.wizard.$inPutSiteUrl.focus();
                        return;
                    }

                    fn.wizard.moveStep();
                });
            },

            finish: function () {
                var data, $choosenChoices = fn.wizard.$choices.find('input[type=checkbox]:checked');

                // Get checked key list.
                data = $.map($choosenChoices, function(itm, idx) {
                    return $(itm).data('key');
                }).join(',');

                fn.$buildWizardBlock.started({opacity: .5});
                ajax.mock('build.save_content', data, function (json) {
                    fn.$buildWizardBlock.completed();
                    if (!json.success) {
                        notify.error(json.msg);
                        return;
                    }

                    notify.success(json.msg);
                    plugin.redirect(siteUrl + '/client/build.php');
                });
            },

            // Move to next or prev step.
            moveStep: function (toPrev) {
                var $activeStep = fn.wizard.$steps.filter('.active'),
                    $candidateStep = toPrev ? $activeStep.prev() : $activeStep.next();

                $activeStep.removeClass('active');
                if ($candidateStep.length) {
                    $candidateStep.addClass('active');
                    if ($candidateStep.is('.step-progress')) {
                        fn.wizard.scrap(0);
                    }
                }
            },

            // Scrap the data from site.
            scrap: function (step) {
                var deg, bgImg = 'linear-gradient(';

                ajax.mock('build.scrap_content', { // NOTICE TO REPLACE mock with post!
                    key: fn.scrapSteps[step]
                }, function (json) {
                    var $step = fn.wizard.$progressRing.children('li').eq(step),
                        $choice = fn.wizard.$choices.eq(step);

                    if (!json.success) {
                        notify.error(json.msg);
                        fn.wizard.$inPutSiteUrl.focus();
                        return;
                    }

                    // Process dom.
                    $step.addClass('active').append('<div class="cnt">' + json.data.length + '</div>');

                    // Add items to step 3 box.
                    $choiceWrap = $('<ul>');
                    if (json.data.length) {
                        $.each(json.data, function(idx, data) {
                            $choiceWrap.append('<li><input data-key="' + data.key + '" type="checkbox" checked><div class="choice-img"><img src="' + data.thumb + '"></div><span>' + data.title + '</span></li>');
                        });
                    } else {
                        $choiceWrap.append('<li><span class="empty">'+fn.phrasesBuild.msgNoContentInCategory+'</span></li>');
                    }
                    $choiceWrap.appendTo($choice);

                    // Prepare next call.
                    step++;

                    if (step > 2) {
                        deg = -90 + 60 * (step - 3);
                        bgImg += deg + 'deg, #5fa148 50%, transparent 50%, transparent), linear-gradient(270deg, #5fa148 50%, #f6f6f6 50%, #f6f6f6)';
                    } else {
                        deg = 90 + 60 * step;
                        bgImg += '90deg, #f6f6f6 50%, transparent 50%, transparent), linear-gradient(' + deg + 'deg, #5fa148 50%, #f6f6f6 50%, #f6f6f6)';
                    }
                    fn.wizard.$progressRing.find('.proc-ring').css('background-image', bgImg);

                    if (step < fn.scrapSteps.length) {
                        fn.wizard.scrap(step);
                    } else {
                        clearInterval(fn.timer);
                        fn.wizard.$progressRing.find('.proc-label').addClass('finished');

                        // Init uniform checkboxes.
                        plugin.init_uniform(fn.wizard.$choices);

                        setTimeout(function () {
                            fn.wizard.moveStep();
                        }, 1000);
                    }
                });
            }
        },

        /**
        * @author: Austin L.
        * @create: Nov 9, 2015
        */
        tabIcon: {
            init: function($picker)
            {
                if (typeof $picker == "undefined") {
                    $picker = $(".tabicon-picker");
                 }

                $picker.flyup({
                    name: "tab_icon",
                    rows: 3,
                    dimension: {
                        all: g_vars.dimensions.tab_icon.all.thumb
                    },
                    list: {all: g_vars.tab_icon},

                    industries: g_vars.tab_icon_industries,

                    onShow: function() {
                        var $toggler = this.$elem;
                        var $tab = $toggler.closest("li.tab");
                        var tabId = $tab.data("tabId");
                        var tabData = fn.getTabData(tabId);
                        var iconColor = $toggler.data("iconColor") + "";
                        var flyupIconColor = this.$flyup.data("iconColor") + "";

                        // Update #tabicon_holder
                        var iconKey = tabData.iconKey;
                        var selId = this.iconKey2Id(tabData.iconKey);
                        $("#tabicon_holder").val(selId);

                        if (typeof flyupIconColor != "undefined" && flyupIconColor.toLowerCase() == iconColor.toLowerCase()) {
                            // return; // Check again ! Not sure why it needs,
                        }

                        // Now, colorize all modern/traditional items of flyup library icons
                        // var isWhite = $toggler.parent().hasClass("is-white");
                        var isWhite = false;
                        
                        if (plugin.isWhite(iconColor)) {
                            isWhite = true;
                        }
                        this.$flyup.toggleClass("is-white", isWhite);
                        this.$flyup.data("iconColor", iconColor);

                        $(".tab-lib div.block", this.$flyup).each(function() {
                            var $block = $(this);
                            if ($block.hasClass("block-g_no_image")) {
                                return true;
                            }

                            $img = $block.find("img.icon-main");
                            if ($img.length == 0) {
                                return true;
                            }

                            var url = plugin.replaceSvgColor($block.data("url"), iconColor);
                            $img.attr({
                                src: url
                            });

                            $block.data({
                                url: url,
                                realUrl: url
                            });
                        });

                    },

                    onSave: function() {
                        var $block = this.getActiveBlock();
                        var blockData = $block.data();

                        var $activeTab = fn.tabNav.getActiveTab();
                        var tabId = $activeTab.data("tabId");

                        fn.setTabChanged(tabId, "icon", true);

                        var iconKey = blockData.filename;
                        if (blockData.tabtype == "lib") {
                            if (blockData.industryId < 100) {
                                // Modern image
                                iconKey = "modern/" + blockData.filename;
                                iconType = "modern";
                            } else {
                                // Traditional
                                iconType = "traditional";
                            }
                        } else {
                            iconType = "custom";
                        }

                        var iconUrl, iconPreviewUrl;
                        
                        $img = $block.find("img.fimg");
                            
                        if (blockData.id == "g_no_image") {
                            shadowUrl = iconUrl = blockData.url;
                            iconKey = "";
                            iconPreviewUrl = $block.data("realUrl");
                        } else {
                            iconUrl = iconPreviewUrl = $img.attr("src");
                            shadowUrl = plugin.replaceSvgColor(iconUrl, config.iconShadowColor);
                        }

                        fn.setTabField(tabId, "iconKey", iconKey);

                        $activeTab.find('.tab-icon-main').attr({
                            src: iconUrl,
                            'data-src': iconUrl
                        }).end()
                        .find(".tab-icon-shadow").attr({
                            src: shadowUrl
                        });

                        $tab_icon_preview = $(".board-model .setting-preview");
                        $("img.icon-color", $tab_icon_preview).data({
                            original: iconKey,
                            type: iconType
                        }).attr("src", iconPreviewUrl);

                        $("img.icon-color-shadow", $tab_icon_preview).data({
                            original: iconKey,
                            type: iconType
                        });

                        if (iconPreviewUrl.indexOf("color") !== -1) {
                            $("img.icon-color-shadow", $tab_icon_preview).attr("src", iconPreviewUrl.split("color")[0] + "color=cccccc");    
                        } else {
                            $("img.icon-color-shadow", $tab_icon_preview).attr("src", iconPreviewUrl + "&color=cccccc");
                        }
                        
                        fn.tabNav.monitor();
                    },

                    onCancel: function() {
                        var _this = this;
                        var $activeTab = fn.tabNav.getActiveTab();

                        if (_this.config.is_deleted) {

                            var url = g_vars.tab_icon.no_image.url;
                            $activeTab.find('.tab-icon-main').attr({
                                src: url,
                                'data-src': url
                            }).end()
                            .find(".tab-icon-shadow").attr({
                                src: url
                            });
                        }
                    }
                });

                /* Dec 19, CV-832 Bruce */
                $(".flyup-tab_icon").on("deleted.flyup", function(event, data) {
                    var deletedIconKey = data.filename || "";
                    if (!deletedIconKey) {
                        return;
                    }

                    var $noImageBlock = $('.block-g_no_image');
                    var noImageUrl = $noImageBlock.data("url");
                    var noImageRealUrl = $noImageBlock.data("realUrl");
                    var t, $tab, $iconMain;

                    for (var tabId in fn.core.data.tabs) {
                        t = fn.core.data.tabs[tabId];

                        $tab = $("li[data-tab-id=" + tabId + "]");
                        if (t.iconKey == deletedIconKey) {
                            t.iconKey = "";
                            t.iconUrl = noImageUrl;

                            $iconMain = $tab.find("img.tab-icon")
                            $iconMain.attr({
                                src: noImageUrl,
                                'data-src': noImageUrl
                            });

                            $tab.find(".tab-icon-wrap").removeClass("is-white");

                            if ($tab.hasClass("active")) {
                                // Update preview in Build / Model section
                                $(".board-model .setting-preview img.icon-color").data({
                                    original: "",
                                    type: "custom"
                                }).attr("src", noImageRealUrl);
                            }
                        }
                    }
                });
            }
        },

        /* Flyup */
        flyup: {

            closeOtherFlyups: function ($flyup) {
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

            bindCancelBtn: function ($flyup, callback) {
                $flyup.find('.btn-cancel').on('click', function () {
                    fn.flyup.cancel($flyup, callback);
                });
            },

            cancel: function ($flyup, callback) {
                $flyup.slideUp('slow', function () {
                    if (callback) {
                        callback();
                    }
                });
            },

            init: function () {
                
            }
        },

        /* Tab Left Nav */
        tabNav: {
            tabs: {},
            $tabNav: null,
            $tabList: null,
            $moreTabWrap: null,
            $inactiveWrap: null,
            $inactiveTabListToggler: null,
            $inactiveTabList: null,
            $removeTabBtn: null,
            $activeToggler: null,
            $tabContent: null,
            $search: null,
            $tabBoards: null,
            $addTabBtn: null,
            $addTabBtnFeature: null,
            maxOrder: 0,
            should_refresh_itself: null,

            getActiveTab: function() {
                return $("._ptl").children('li.tab.active');
            },

            init: function () {
                // Init dom elements.

                fn.tabNav.should_refresh_itself = [
                    'comments',
                    'attend',
                    'images',
                ];

                fn.tabNav.$tabNav = fn.$buildTabBlock.find('.block-content.feature .tab-nav');

                fn.tabNav.$tabList = fn.tabNav.$tabNav.children('.tab-list');
                fn.tabNav.$moreTabWrap = fn.tabNav.$tabNav.children('.more-tab-wrap');
                fn.tabNav.$inactiveWrap = fn.tabNav.$tabNav.children('.inactive-tab-list-wrap');
                fn.tabNav.$inactiveTabListToggler = fn.tabNav.$inactiveWrap.find('.inactive-tab-list-toggler');
                fn.tabNav.$inactiveTabList = fn.tabNav.$inactiveWrap.children('.tab-list');
                fn.tabNav.$activeToggler = fn.$buildTabBlock.find('.togglebox.active-toggler');

                fn.tabNav.$search = fn.tabNav.$tabNav.find('.tab-nav-search');

                fn.tabNav.$tabContent = fn.$buildTabBlockContent.find('.tab-content');
                fn.tabNav.$tabBoards = fn.tabNav.$tabContent.find('.tab-boards');

                fn.tabNav.$removeTabBtn = fn.$buildTabBlock.find('.btn-remove');
                fn.tabNav.$addTabBtn = fn.$buildTabBlock.find('.btn-add-new-tab');
                fn.tabNav.$addTabBtnFeature = fn.$buildTabBlock.find('.btn-add-new-tab-no-feature');

                // Load tab data.
                fn.tabNav.render();

                // Adjust the height of block content.
                $(window).on('resize', fn.tabNav.adjustHeight);
                fn.tabNav.adjustHeight();

                if (!fn.tabNav.$tabList.children('li.tab').length) {
                    fn.tabNav.$tabList.addClass('no-tabs');
                }

                // Init uniform for check boxes.
                plugin.init_uniform(fn.tabNav.$tabList.children('li.tab'));
                plugin.init_uniform(fn.tabNav.$inactiveTabList.children('li.tab'));

                // Search
                fn.tabNav.$search.find('.icon-tab-search').on('click', function() {
                    // $(this).addClass('hide');
                    if ( $(this).hasClass('active') ) {
                        fn.tabNav.$tabNav.find('.search-box-close').trigger('click');
                        return;
                    }
                    $(this).addClass('active');
                    fn.tabNav.$addTabBtn.addClass('hide');
                    fn.tabNav.$tabNav.find('.search-box').removeClass('hide');
                    fn.tabNav.$tabNav.find('.search-key-container').focus();
                });
                
                // Cancel search box.
                fn.tabNav.$tabNav.find('.search-box-close').on('click', function() {
                    fn.tabNav.$search.find('.icon-tab-search').removeClass('active');
                    fn.tabNav.$tabNav.find('.search-box').addClass('hide');
                    fn.tabNav.$addTabBtn.removeClass('hide');
                    fn.tabNav.$search.find('.icon-tab-search').removeClass('hide');
                    fn.tabNav.$tabNav.find('li.no-tab-matched').hide();
                    fn.tabNav.$tabNav.find('.search-key-container').val('');
                    fn.tabNav.search();
                });

                fn.tabNav.$tabNav.find('.search-key-container').on('keyup', fn.tabNav.search);

                // Bind checkboxes to select tabs.
                fn.tabNav.$tabNav.on('change', 'div.tab-header input[type=checkbox]', fn.tabNav.choose);

                // Make tab list sortable.
                fn.tabNav.$tabList.sortable({
                    items: '.tab',
                    revert: true,
                    opacity: 0.5,
                    axis: 'y',
                    helper: 'clone',
                    handle: '.tab-header i.tab-drag',
                    stop: fn.tabNav.sorted
                }).disableSelection();

                fn.tabNav.$inactiveTabList.sortable({
                    items: '.tab',
                    revert: true,
                    opacity: 0.5,
                    axis: 'y',
                    helper: 'clone',
                    handle: '.tab-header i.tab-drag',
                    stop: fn.tabNav.sorted
                }).disableSelection();

                /******** Tab Nav Top Controls ********/
                // Bind remove tab button.
                fn.tabNav.$removeTabBtn.bind_confirm({
                    name: 'remove-tab',
                    before: fn.tabNav.beforeRemove,
                    onSubmit: fn.tabNav.remove
                });

                // Bind add tab modal.
                fn.modal.addTab.init();
                
                $.bind_modal({
                    selector: '.btn-add-new-tab',
                    modalId: 'add_tab_modal',
                    onHide: fn.modal.addTab.reset,
                    onShow: function () {
                        fn.flyup.closeOtherFlyups();
                        // fn.modal.addTab.reloadViewControllers();
                        fn.modal.addTab.render();
                    },
                    onShown: function () {
                        fn.modal.addTab.$search.find('input').focus();
                    }
                });

                fn.tabNav.$addTabBtnFeature.on('click', function() {
                    fn.tabNav.$addTabBtn.trigger('click');
                });

                /******** The misc ********/
                // Bind toggler.
                fn.tabNav.$activeToggler.togglebox().on('changed', fn.tabNav.procTabStatus);

                // Init selectboxes.
                plugin.init_selectbox({
                    selector: fn.$buildTabBlock.find('select')
                });

                // Bind tabs.
                fn.tabNav.$tabNav.on('positive_click', '.select-tab', fn.tabNav.selectTab);
                fn.tabNav.bindBeforeLeave();

                /*
                $("#btn_before_leave_tab").bind_confirm({
                    name: 'confirm_tab_unload',
                    before: function(){return true;},
                    onSubmit: fn.tabNav.selectTab
                });
                */

                // Bind tab options.
                fn.tabNav.$tabNav.on('positive_click', 'li.tab ul.tab-body > li', fn.tabNav.loadContent);

                // Bind inactive tab list toggler.
                fn.tabNav.$inactiveTabListToggler.on('click', fn.tabNav.togglerInactiveTabList);
                $(window).on('resize', fn.tabNav.resizeInactiveTabList);
                fn.helpInfo.checkOnboardingAvailable();
            },

            fixMoreTabPosition: function(bottom, is_animate) {
                bottom = parseInt(bottom);

                if (is_animate) {
                    fn.tabNav.$moreTabWrap.animate({
                        bottom: bottom
                    });
                } else {
                    fn.tabNav.$moreTabWrap.css("bottom", bottom + "px");
                }
            },

            bindBeforeLeave: function () {

                fn.tabNav.$tabNav.find('.select-tab').bind_confirm({
                    name: 'confirm_tab_unload',
                    before: fn.tabNav.beforeLeaveTab,
                    onSubmit: function(e, opts, safe) {
                        if (safe != undefined && safe) {
                            fn.tab.save();
                        }
                        fn.tabNav.removeIconChanges();
                        $(opts.delegator).trigger("positive_click");

                        if (opts.leavingTabId == 0) {
                            if (g_vars.more_tab.use_default_theme == 0) {
                                fn.tabNav.$moreTabWrap.removeClass("default-theme").addClass("custom-theme");
                            } else {
                                fn.tabNav.$moreTabWrap.removeClass("custom-theme").addClass("default-theme");
                            }
                        }
                    }
                });


                fn.tabNav.$tabNav.find('li.tab ul.tab-body > li').bind_confirm({
                    name: 'confirm_tab_unload',
                    before: fn.tabNav.beforeLeaveSection,
                    onSubmit: function(e, opts) {
                        fn.tabNav.removeIconChanges();

                        console.log('Line 739 - before [positive_click]');
                        console.log(opts);
                        $(opts.delegator).trigger("positive_click");

                        if (opts.leavingTabId == 0) {                        	
                            if (g_vars.more_tab.use_default_theme == 0) {
                                fn.tabNav.$moreTabWrap.removeClass("default-theme").addClass("custom-theme");
                            } else {
                                fn.tabNav.$moreTabWrap.removeClass("custom-theme").addClass("default-theme");
                            }
                        }
                    },
                    onSubmitSafe: function (e, opts) {
                        fn.tab.event = e;
                        fn.tab.opts = opts;
                        fn.tab.save();
                    }
                });

            },

            resetTabIconColor: function() {
                if ( typeof g_vars.template_detail == "undefined") return;
                
                var $activeTab = fn.tabNav.$tabNav.find('li.tab.active');
                var original_color = $activeTab.find(".tabicon-picker").attr("data-icon-color");

                $activeTab.find(".tabicon-picker").data("iconColor", original_color);
            },

            loadTab: function(data) {

                var tabId = parseInt(data.tab_id);
                var sectionV = data.sub_route;
                //var $container = fn.tabNav.$tabList;
                var $container = fn.tabNav.$tabNav;

                if (tabId < 0 || typeof sectionV == "undefined" || sectionV == "") {
                    fn.tabNav.selectTab(this, true);
                    return false;
                }

                if (tabId == 0) {
                    $container = fn.tabNav.$moreTabWrap;
                }

                var $active_li = $container.find('li[data-tab-id=' + tabId + ']');
                /*
                if ($active_li.hasClass('hidden')) {
                    // By search, active link is hidden, so let's remove search key
                    fn.tabNav.$search.find('input').val('');
                    fn.tabNav.search();
                }
                // $active_li.addClass('active');
                */
                if ($active_li.length == 0) {
                    fn.tabNav.selectTab(this, true);
                    return false;
                }


                fn.core.setupOverlay(false);

                var $active_li_sec = $active_li.find('.tab-body li.kv-' + sectionV);
                if (data.reload) {
                    $active_li_sec.removeAttr('data-loaded');
                }

                $active_li_sec.addClass('active');
                if (tabId != 0) {
                    $active_li_sec.siblings().removeClass('active')
                }

                if (tabId == 0) {
                    $active_li.find('.select-tab').trigger('click');
                } else {
                    if ($active_li.hasClass('tab-inactive')) {
                        $active_li.find('.tab-header .tab-title').trigger('click');
                        setTimeout(function(){
                            fn.tabNav.procInactiveTabList(false, true);
                        }, 1000);

                    } else {
                        $active_li.find('.tab-header .tab-title').trigger('click');
                        if (!data.reload) {
                            fn.tabNav.$tabList.scrollTop($active_li.offset().top - fn.tabNav.$tabList.offset().top);
                        }
                    }
                }

                return true;

            },

            reloadTab: function(data) {
                var $container = fn.tabNav.$tabNav; //fn.tabNav.$tabList;
                if (data.tab_id == 0) {
                    $container = fn.tabNav.$moreTabWrap;
                }

                var $active_li_sec = $container.find('li[data-tab-id=' + data.tab_id + ']').find('.tab-body li.kv-' + data.sub_route);
                if (data.reload) {
                    $active_li_sec.removeAttr('data-loaded');

                    // For reload, we need to remove content li completely, id rule updated
                    fn.tabNav.$tabBoards.find('#' + data.sub_route + '_' + data.tab_id).remove();
                }

                $active_li_sec.trigger('positive_click');
            },

            reload: function (e) {
                var data = {
                    'tab_id': $(this).attr('data-tab-id'),
                    'sub_route': $(this).attr('sub-route'),
                    'reload': true
                };

                fn.tabNav.reloadTab(data);
            },

            render: function () {
                if (fn.core.data.tabs) {
                    /*
                    $.each(fn.core.data.tabs, function (tabId, tab) {
                        var seqv = tab.seq;
                        if (fn.tabNav.maxOrder < seqv) fn.tabNav.maxOrder = seqv;
                        fn.tabNav.addTab(fn.getTabData(tabId));
                    });
                    */

                    // Austin added this section because somehow tabs are not ordered by its seq...
                    // also there are tabs with same seq some how...
                    var orderd_ids = {};
                    var offset_seq = 100; // let s assume there wont be more than 100 tabs with same seq
                    $.each(fn.core.data.tabs, function (tabId, tab) {
                        if (tabId == 0) {
                            // More tab
                            return true;
                        }

                        var seqv = tab.seq;
                        var keyv = offset_seq * seqv;
                        if (fn.tabNav.maxOrder < seqv) {
                            fn.tabNav.maxOrder = seqv;
                        }

                        while (keyv in orderd_ids) {
                            keyv++;
                        }

                        orderd_ids[keyv] = tabId;
                    });

                    $.each(orderd_ids, function (seq, tabId) {
                        fn.tabNav.addTab(fn.getTabData(tabId));
                    });
                }
            },

            addTab: function (tab) {
                if (typeof tab.tabId == "undefined") {
                    // console.log("fn.tabNav.addTab() - Invalid tabId");
                }

                var tabId = tab.tabId;
                var route = tab.baseRoute;
                var shadowUrl = plugin.replaceSvgColor(tab.iconUrl, config.iconShadowColor);
                var whiteClass = '';

                if (plugin.isWhite(tab.iconColor) && tab.iconUrl.indexOf("no_button.png") == -1) {
                    whiteClass = ' is-white';
                }

                var $li, html;

                html = '<li class="tab ' + (tab.active ? 'tab-active' : 'tab-inactive') + '" data-tab-id="' + tabId + '" data-abbr="' + tab.abbr + '">'
                     + '<div class="tab-line"></div>'
                     + '<div class="tab-header">'
                     +   '<div class="left">';
                
                if (fn.isAddTabEnabled()) {
                    html += '<input class="choose-tab" type="checkbox">';
                }

                html += '<i class="tab-drag fa fa-arrows"></i>'
                     +     '<div class="tab-icon-wrap select-tab' + whiteClass + '"><div data-icon-color="' + tab.iconColor + '" class="tabicon-picker" data-element="#tabicon_holder"><i class="fa fa-cog"></i></div>'
                     +       '<img class="tab-icon tab-icon-main" src="' + tab.iconUrl + '" data-src="' + tab.iconUrl + '">'
                     +       '<img class="tab-icon tab-icon-shadow" src="' + shadowUrl + '">'
                     +     '</div>'
                     +   '</div>'
                     + '<div class="tab-title select-tab"><span class="tab-label">' + escapeHtml(tab.tabLabel) + '</span><span class="tab-desc">(' + escapeHtml(tab.desc) + ')</span></div>'
                     + '<div class="active-toggler togglebox' + (tab.active ? ' checked' : '') + '"></div></div>';

                html += '<ul class="tab-body">';
                var section_list = fn.core.data.tab_opts['default'];
                if (route in fn.core.data.tab_opts['custom']) {
                    section_list = fn.core.data.tab_opts['custom'][route];
                }

                for (var kv in section_list) {
                    if (kv == 'model') {
                    	if ( !fn.isCustomDesignEnabled() ) {
                            continue;
                        }
                    }

                    if (section_list[kv]['has']) {
                        html += '<li data-route="' + kv + '" class="kv-' + kv + '"><div class="tab-radio"><span></span></div><span>'+escapeHtml(section_list[kv]['label'])+'</span></li>';
                    }
                }
                html += '</ul></li>';

                $li = $(html);

                $li.appendTo(tab.active ? fn.tabNav.$tabList : fn.tabNav.$inactiveTabList);

                $li.find('.togglebox.active-toggler').togglebox().on('changed', fn.tabNav.procTabStatus);
                plugin.init_uniform($li);

                return $li;
            },

            search: function () {
                var needle = fn.tabNav.$tabNav.find('.search-key-container').val().toLowerCase(),
                    $tabs = fn.tabNav.$tabNav.find('li.tab'),
                    $noTabMatched = fn.tabNav.$tabNav.find('li.no-tab-matched'),
                    $tabs = fn.tabNav.$tabList.find('li.tab'),
                    doSearch = function ($wrap) {
                        var noTabMatched = true;

                        $.each($wrap.find('li.tab'), function (idx, itm) {
                            var haystack = $(itm).find('.tab-header .tab-title .tab-label').html().toLowerCase();
                            haystack = haystack + $(itm).find('.tab-header .tab-title .tab-desc').html().toLowerCase();

                            if (haystack.indexOf(needle) != -1) {
                                $(itm).removeClass('hidden');
                                $wrap.find('li.no-tab-matched').hide();
                                noTabMatched = false;
                            } else {
                                $(itm).addClass('hidden');
                            }
                        });
                        if (noTabMatched) {
                            $wrap.addClass('no-matched');
                            $wrap.find('li.no-tab-matched').show();
                        } else {
                            $wrap.removeClass('no-matched');
                        }
                    };

                if (!$tabs.length) {
                    fn.tabNav.$tabList.addClass('no-tabs');
                    return;
                }
                if (!needle) {
                    $tabs.removeClass('hidden');
                    fn.tabNav.$tabList.removeClass('no-tabs no-matched');
                    return;
                }

                doSearch(fn.tabNav.$tabList);
            },

            procInactiveTabList: function (toggleDisabled, force) {
                var $tabs = fn.tabNav.$inactiveTabList.children('li.tab'),
                    maxHeight = (fn.tabNav.$tabNav.outerHeight() - fn.$buildTabBlock.find('.tab-action-toolbar').outerHeight()) / 2,
                    togglerHeight = fn.tabNav.$inactiveTabListToggler.outerHeight(),
                    // tabWrapHeight = $tabs.length ? 0 : fn.tabNav.$inactiveTabList.find('>li.no-tab-label').height(),
                    tabWrapHeight = $tabs.length ? 0 : 120,
                    $inActiveZone_ActiveTab = fn.tabNav.$inactiveTabList.children('li.tab.active'),
                    inActiveZone_ActiveTabBodyHeight = $inActiveZone_ActiveTab.find('.tab-body').children('li').length * 40 + 20;

                // Set default values.
                toggleDisabled = toggleDisabled || false;
                force = force || false;

                // If there is no tabs.
                if ($tabs.length) {
                    fn.tabNav.$inactiveTabList.removeClass('no-tabs');
                    tabWrapHeight = $tabs.length * 40 + 20;
                    /*
                    $.each($tabs, function (idx, itm) {
                        tabWrapHeight += $(itm).outerHeight();
                    });
                    */
                } else {
                    fn.tabNav.$inactiveTabList.addClass('no-tabs');
                    /*
                    toggleDisabled = false;
                    force = true;
                    */
                }

                if (toggleDisabled) {
                    if (fn.tabNav.$inactiveWrap.is('.open')) {
                        tabWrapHeight += togglerHeight;
                        tabWrapHeight = tabWrapHeight > maxHeight ? maxHeight : tabWrapHeight;
                        tabWrapHeight += inActiveZone_ActiveTabBodyHeight; // lets count on active tab in inactive zone

                        fn.tabNav.fixMoreTabPosition(tabWrapHeight);
                        fn.tabNav.$inactiveWrap.height(tabWrapHeight);
                        fn.tabNav.$inactiveTabList.height(tabWrapHeight - togglerHeight);

                        // lets foccus to currently openned item
                        if ($inActiveZone_ActiveTab.length > 0) {
                            var offtop = $inActiveZone_ActiveTab.offset().top - fn.tabNav.$inactiveTabList.offset().top + fn.tabNav.$inactiveTabList.scrollTop();
                            fn.tabNav.$inactiveTabList.scrollTop(offtop);
                        } else {
                            fn.tabNav.$inactiveTabList.scrollTop(0);
                        }

                    }
                    return;
                }
                if (force || !fn.tabNav.$inactiveWrap.is('.open')) {
                    tabWrapHeight += togglerHeight;
                    tabWrapHeight = tabWrapHeight > maxHeight ? maxHeight : tabWrapHeight;
                    tabWrapHeight += inActiveZone_ActiveTabBodyHeight; // lets count on active tab in inactive zone

                    fn.tabNav.fixMoreTabPosition(tabWrapHeight);
                    fn.tabNav.$inactiveWrap.height(tabWrapHeight);
                    fn.tabNav.$inactiveTabList.height(tabWrapHeight - togglerHeight);
                    fn.tabNav.$inactiveWrap.addClass('open');

                    // lets foccus to currently openned item
                    if ($inActiveZone_ActiveTab.length > 0) {
                        var offtop = $inActiveZone_ActiveTab.offset().top - fn.tabNav.$inactiveTabList.offset().top + fn.tabNav.$inactiveTabList.scrollTop();
                        fn.tabNav.$inactiveTabList.scrollTop(offtop);
                    } else {
                        fn.tabNav.$inactiveTabList.scrollTop(0);
                    }

                } else {
                    // seems this is close case... then should close opened tab in inactive zone
                    fn.tabNav.fixMoreTabPosition(togglerHeight + 2);
                    fn.tabNav.$inactiveWrap.height(togglerHeight);

                    fn.tabNav.$inactiveWrap.removeClass('open');

                    // fn.tabNav.$inactiveWrap.find(".tab-body").height(0);

                }
            },

            togglerInactiveTabList: function () {
                fn.tabNav.procInactiveTabList();
            },

            resizeInactiveTabList: function () {
                fn.tabNav.procInactiveTabList(true);
            },

            openInactiveTabList: function () {
                fn.tabNav.procInactiveTabList(false, true);
            },

            procTabStatus: function () {
                var checked = $(this).data('checked'),
                    $tab = $(this).parents('li.tab'),
                    $tabChooser = $tab.find('.tab-header input[type=checkbox]');

                if (checked) {
                    $tab.addClass('tab-active').removeClass('tab-inactive');
                    $tab.appendTo(fn.tabNav.$tabList);
                } else {
                    $tab.removeClass('tab-active').addClass('tab-inactive');
                    $tabChooser.attr('checked', false);
                    $.uniform.update($tabChooser);
                    $tab.prependTo(fn.tabNav.$inactiveTabList);
                    // Should open inactive tab list.
                    fn.tabNav.openInactiveTabList();
                }
                fn.tabNav.procActiveTabList();
                fn.tabNav.resizeInactiveTabList();
                fn.tabNav.choose();
                fn.tabNav.monitor();
                fn.helpInfo.checkOnboardingAvailable();
            },

            procActiveTabList: function () {
                // if search box holds data, then do search - Douglas...
                if (fn.tabNav.$search.find('.icon-tab-search').hasClass('active')) {
                    fn.tabNav.search();
                }

                // if no active tab is existed, we should show no content screen - Douglas...
                var $activeTabs = fn.tabNav.$tabList.find('.tab.tab-active');
                if ($activeTabs.length) {
                    var $activeTab = $activeTabs.find('.active');
                    if ($activeTab.length == 0) {
                        $($activeTabs.get(0)).find('.select-tab').trigger('positive_click');
                    } else {
                        fn.tabNav.$tabBoards.children('li.board-content').show();
                    }
                    fn.tabNav.$tabBoards.children('li.no-content').removeClass('active');
                } else {
                    fn.tabNav.$tabBoards.children('li.no-content').addClass('active').siblings().hide();
                }
            },

            sorted: function (e, ui) {
                // Now save the sequence change live

                fn.tabNav.monitor();
            },

            activeFirstTab: function () {
                var $activeTabs = fn.tabNav.$tabList.find('.tab.tab-active');

                if ($activeTabs.length) {
                    $activeTabs.eq(0).find('.tab-header .tab-icon-wrap').trigger('click');
                }
            },

            adjustHeight: function () {
                var winHeight = $(window).height(),
                    // offsetHeight = $('.navbar-header').outerHeight() + $('.page-header').outerHeight();
                    offsetHeight = $('.header').position().top + $('.header').outerHeight() + $('.page-header').outerHeight();

                // fn.$buildTabBlockContent.css('height', winHeight - offsetHeight);
                //fn.tabNav.$tabContent.css('min-height', winHeight - offsetHeight - 50);
                // fn.tabNav.$tabContent.css('min-height', winHeight - offsetHeight);
                fn.tabNav.$tabContent.css('min-height', '100%');
            },

            update: function (data) {
                if (data.removed) {
                    $.map(data.removed, function (tabId) {
                        fn.removeTabData(tabId);
                    });
                }
                if (data.added) {
                    $.each(data.added, function (oldId, newId) {
                        $('[data-tab-id="' + oldId + '"]').attr('data-tab-id', newId);
                        fn.setTabData(newId, fn.getTabData(oldId));
                        fn.removeTabData(oldId);
                    });
                }

                $.each(fn.core.data.tabs, function (tabId, tab) {
                    fn.setTabField(tabId, "changed", {});
                });
            },

            clearAllContent: function(show_no_content) {

                $.each(fn.tabNav.$tabBoards.children('li').not('.no-content'), function(i, o){
                    // remove modals first
                    // if ($(o).attr('data-tab-id') == tabId) return true;

                    fn.tabNav.clearContent(o);

                });

                if (show_no_content) {
                    fn.tabNav.$tabBoards.children('li.no-content').addClass('active');
                }

            },

            clearContent: function(o) {

                var mids = $(o).data('bams');
                if (mids) {
                    for (var mind=0; mind<mids.length; mind++) {
                        while ($('#' + mids[mind]).length) {
                            $('#' + mids[mind]).remove();
                        }
                    }
                }
                // remove itself
                $(o).remove();
            },

            loadContent: function () {
                var $this = $(this);
                var $tab = $this.parents('.tab');
                var $tabBody = $tab.find('.tab-body');
                var $tabOpts = $tabBody.children('li');
                var $tabBoardLiList = fn.tabNav.$tabBoards.children('li');
                var tabId = $tab.data('tabId');
                var viewControllerAbbr = $tab.data('abbr');
                var key = $this.data('key');
                var loaded = $this.is('[data-loaded]');

                var tabData, baseRoute, subRoute;
                tabData = fn.getTabData(tabId);
                if (!tabData) return;

                fn.tab.$save.show();

                baseRoute = tabData.baseRoute;
                subRoute = $this.data('route');

                // CV-2948
                // Piotr Bozetka
                // function to check if the Redactor 2 v2 editor is alowed in this tab
                // plugin.is_tab_allowed(baseRoute);

                fn.tabNav.$tabContent.completed();

                if ($this.hasClass("active") && loaded) {
                    // Do not load the content again if you try to load current active board again

                    if (fn.tabNav.showActiveTabContent()) {
                    // if (false) {
                        fn.tab.activated();
                        return false;
                    } else {
                        $(this).removeAttr('data-loaded');
                        loaded = false;
                    }
                }

                var route;
                var changes;
                var params = {id: tabId};

                if (subRoute == "model") {
                    route = 'tab.model.load';
                } else {
                    route = 'tab.' + baseRoute + '.' + subRoute;
                }

                /***
                * Show / Hide "Use Global Design" button
                */
                var $btnDisableModel = $(".page-header button.btn-disable-model");
                var $tooltipBox = $(".page-header .tooltip-box");
                if (subRoute == "model") {
                    // If clicked Model and already loaded, show/hide Use Global Design button
                    // based on the current status of this tab
                    if (loaded) {
                        var selector = '.board-model.' + baseRoute + '[data-tab-id=' + tabId + ']';
                        var $tab = $tabBoardLiList.filter(selector);

                        if ($("input[name=tab_model_enabled]").val() != 0) {

                            // If enabled, then show "Use Global Design" button
                            $tooltipBox.css("opacity", 0).animate({opacity: 1});

                        } else {

                            // If disabled, then hide "Use Global Design" button
                            $btnDisableModel.fadeOut();
                            $(".page-header .btn-toolbar").removeClass('with-disable-model-button');
                        }
                    }
                } else {
                    // If not model, just hide this button
                    $btnDisableModel.fadeOut();
                    $(".page-header .btn-toolbar").removeClass('with-disable-model-button');
                }

                /*
                fn.tabNav.monitor();
                changes = fn.tabNav.getChanges();
                if (changes) {
                    params['tabs'] = changes;
                }
                */

                $tabOpts.removeClass('active');
                $this.addClass('active');

                // If still not loaded.
                fn.tabNav.$tabBoards.children('li.no-content').removeClass('active');
                $("body").children(".wrapper").children(".content").scrollTop(0);


                if (fn.tabNav.should_refresh_itself.indexOf(subRoute) !== -1) {
                    // should reload, so only remove myself
                    loaded = false;
                }

                if (!loaded || true) { // Austin added {|| true} to enable <always-reload-concept>, so that i always load the content
                    // Render html.


                    // fn.tabNav.$tabContent.started({opacity: .5});
                    fn.tabNav.$tabContent.overlay({'opacity': 1, 'background-color': '#f8f8f8'}); // Remove Opacity
                    fn.tab.$save.attr('disabled', true);

                    ajax.post(route, params, function (json) {
                        
                        /* first of all, let's see if session is timeout*/
                        if (!json.success) {
                            notify.error(json.msg);
                            fn.tabNav.$tabContent.completed();
                            fn.tabNav.clearAllContent(true);
                            return;
                        }

                        /*
                        // Update tab navigation.
                        if (json.data && json.data.tabs) {
                            fn.tabNav.update(json.data.tabs);
                        }
                        */

                        // ---------------------------------------------------------------------------------
                        // let's check if this is the right content for current navigation one
                        var $activeTabLink = fn.tabNav.getActiveTab();
                        var tabId = $activeTabLink.data('tabId');
                        var active_sub_route = $activeTabLink.find(".tab-body li.active").attr('data-route');

                        if ((tabId == json.data.x.t) && (active_sub_route == json.data.x.r[2])) {
                            // let's check if content is already loaded, then no need to re-fill the content, right?
                            $activeTabContent = fn.tabNav.$tabBoards.find('#' + active_sub_route + '_' + tabId);
                            if ($activeTabContent.hasClass('active') && false) {
                                fn.tabNav.$tabContent.completed();
                                return;
                            }

                        } else {
                            // Invalid content, so just ignore it
                            return;
                        }
                        // ---------------------------------------------------------------------------------


                        /////////////////////////////////////////////////////////////////
                        // Now let's remove already loaded contents completely
                        //
                        if (false && (fn.tabNav.should_refresh_itself.indexOf(json.data.x.r[2]) !== -1)) { // Austin added false && as it should reload every section, so should remove all
                            // should reload, so only remove myself
                            var idv = "#" + json.data.x.r[2] + "_" + json.data.x.t;
                            fn.tabNav.clearContent(idv);
                        } else {
                            fn.tabNav.clearAllContent();
                        }
                        // ----------------------------------

                        // let's setup loading screen again... /* Not sure why setup loading screen again, so removed - Douglas */
                        // fn.tabNav.$tabContent.overlay({'opacity': 1, 'background-color': '#f8f8f8'}); // Remove Opacity

                        fn.tab.deActivated(); // call current active tab's deacitvate handler
                        $tabBoardLiList.removeClass('active');

                        // Update g_vars. (added by David, it will be needed to use flyup.)
                        if (json.g_vars) {
                            $.extend(g_vars, json.g_vars);
                        }

                        /*
                        // Solution 1:
                        // Austin added - once loaded, need to sync selected sub item according to what is actually loaded
                        var sub_li_obj = $("ul.tab-list li.tab[data-tab-id=" + tabId + "]").find("li[data-route=" + subRoute + "]").addClass("active").siblings().removeClass("active");
                        */

                        // Solution 2:
                        // If currently selected li does not match with loaded data, then let's load correct one again
                        // But this cause endless looping if you quickly click another section before [content] section is loaded
                        /*
                        var sub_li_obj = $("ul.tab-list li.tab[data-tab-id=" + tabId + "]").find("li[data-route=" + subRoute + "]");
                        if ($(sub_li_obj).hasClass("active") == false) {
                            $(sub_li_obj).trigger("click");
                            return;
                        }
                        */

                        // Solutin 3:
                        // If currently loaded page is not same with current active section, then just ignore the content loaded just now
                        // This might work only for <always-reload-concept>

                        // Added By Meng. OPEN app previewer when loading content.
                        if (subRoute == 'content' && !first_visit) {
                            setTimeout(function() {
                                window.app_previewer.forceExpand();
                            }, 200);
                        }

                        if (subRoute == "model") {
                            $("li.board-model", fn.tabNav.$tabBoards).remove();
                        } else {
                            $("li." + baseRoute+'_'+subRoute, fn.tabNav.$tabBoards).remove(); // Remove old content
                        }

                        /***
                        * examples:  (by Austin)
                        *        baseRoute:  fanWallManagerView
                        *        subRoute: content, model, comments
                        */
                        var tab_class = 'board-' + subRoute            // board-content
                                 + ' ' + baseRoute                     // fanWallManagerView
                                 + ' ' + baseRoute + '_' + subRoute    // fanWallManagerView_content
                                 + ' ' + viewControllerAbbr            // fwmv (Abbreviation for CSS) - see view_controllers.abbr
                                 + ' active';
                        var tab_cont_id = subRoute + '_' + tabId;

                        $li = $('<li id="' + tab_cont_id + '" class="' + tab_class + '" data-tab-id="' + tabId + '" data-route="' + baseRoute + '" sub-route="' + subRoute + '" data-key="' + tab_cont_id + '">');

                        // Remove duplicated modals.
                        $('.modal.' + tab_cont_id).remove(); // Remove old modals for this tab

                        $li.append(json.html);

                        // $li.append('<input type="hidden" id="app_code_4flyupagent" value="' + json.data.app_code +'" />');
                        // Remove duplicated modals.
                        var modal_ids = [];
                        $.each($li.find('.modal'), function (idx, itm) {
                            var id = $(itm).attr('id');
                            if ($('#' + id).length) {
                                $(itm).remove();
                            } else {
                                $(itm).data("baseRoute", baseRoute).appendTo($('body')).addClass(tab_cont_id);
                            }
                            modal_ids.push(id);
                        });
                        $li.data('bams', modal_ids);

                        $li.appendTo(fn.tabNav.$tabBoards);

                        plugin.init_uniform($li);

                        /* for preventing loading spin when scroll down after navigating comments or activities sub section - Douglas */
                        $('.content').off('scroll');

                        $li.on('monitor', fn.tab.monitor)
                           .on('content_changed', fn.tab.my_content_changed)
                           .on('tab_nave_changed', fn.tabNav.isChanged)
                           .on('onUpdateFlyupAgent', fn.tab.onUpdateFlyupAgent)
                           .on('onEmojiSetup', fn.tab.onEmojiSetup)
                           .on('getContentData', fn.tab.get_content_data)
                           .on('save', fn.tab.save)
                           .on('forceSave', fn.tab.forceSave)
                           .on('reload', fn.tabNav.reload)
                           .on('flyup_loaded', function () {
                                // fn.tabNav.$tabContent.completed();
                           });

                        if (subRoute == "model") {
                            if ($("input[name=tab_model_enabled]").val() != 0) {
                                $(".page-header .btn-toolbar").addClass('with-disable-model-button');
                            } else {
                                $(".page-header .btn-toolbar").removeClass('with-disable-model-button');
                            }
                        }

                        /*
                         __        ___  __           __          __
                        /  ` |__| |__  /  ` |__/    |__)  /\  | |__)
                        \__, |  | |___ \__, |  \    |    /~~\ | |  \
                        */
                        // Let's check again if this content is right for currenctly active tab in Tab Nav

                        var sub_li_obj = $("ul.tab-list, ul.more-tab-wrap").find("li.tab[data-tab-id=" + tabId + "]").find("li[data-route=" + subRoute + "]");
                        if ($(sub_li_obj).hasClass("active") == false) {
                            // Lets find out what is currently selected
                            fn.tabNav.showActiveTabContent();
                            return;
                        }

                        // If this is under-construction page, no need to load any js
                        if (json.data.na) {
                            fn.tabNav.$tabContent.completed();
                            return;
                        }


                        // Load tab origin script.
                        // let's choose different js file according to the sub conent
                        var jsFile = 'scripts/tabs/' + baseRoute.toLowerCase();
                        var subRouteLower = subRoute.toLowerCase();
                        switch (subRouteLower) {
                        case "comments":
                            jsFile = 'scripts/tabs/common_comments';
                            break;
                        case "attend":
                            jsFile = 'scripts/tabs/common_attend';
                            break;
                        case "model":
                            jsFile = 'scripts/tabs/common_model';
                            break;

                        case "content":
                            // do nothing
                            break;

                        default:
                            jsFile = jsFile + "_" + subRoute.toLowerCase();
                        }
                        
                        // Added by Daniel Lu
                        // This will load the cedar version js library and it will be updated for only content js
                        if ( subRouteLower == 'content' && tabData.isSupportCedar == '1' ) {
                            jsFile += '_cedar';
                        }
                        
                        if ( subRouteLower == 'content' && tabData.isV2 == '1' ) {
                            jsFile += '_v2';
                        }
                        
                        // now load js file
                        try {
                            require([jsFile], function (tab) {
                                var opts = {
                                    $content: fn.tabNav.$tabContent,
                                    $wrap: $li,
                                    tabId: tabId,
                                    route: {
                                        base: baseRoute,
                                        sub: subRoute
                                    }
                                };

                                if (json.data) {
                                    opts['data'] = json.data;
                                }

                                tab.init(opts);

                                // setTimeout( function () {
                                //     $li.trigger('init_load_done');
                                // }, 300);

                                /*setTimeout(function() {

                                    // fn.tabNav.$tabContent.completed();

                                    setTimeout(function() {
                                        fn.tab.monitor();
                                    }, 1000);

                                    if(first_visit) {
                                        fn.helpInfo.$onboarding_build_btn.trigger('click');
                                    }
                                    for (var ii=0; ii<20; ii++) {
                                        setTimeout(function() {
                                            fn.tab.monitor();
                                        }, 1000 + 100* ii);
                                    }

                                }, 1000);*/

                            }, function (err) {
                                //display error to user
                                fn.tabNav.$tabContent.completed();
                                console.log(err);
                            });

                        } catch (err) {
                            fn.tabNav.$tabContent.completed();
                            console.log(err);
                        }

                        $this.attr('data-loaded', true);
                        $li.addClass('active').siblings().removeClass('active');

                        // @added - Aug 31, 2015 - Austin L.
                        // @updated - Sep 18, 2015 - Austin L. - rows changed to 2
                        // Thumbnail image
                        if (subRoute == "content") {
                            $(".img-picker-thumb", $li).flyup({
                                name: "thumb",
                                is_default_of: true,
                                rows: 2,
                                devices: ["all"],
                                dimension: {
                                    block: {
                                        margin: 6,
                                        border: 3,
                                        padding: 3
                                    },
                                    all: g_vars.dimensions.thumb.all.thumb
                                },
                                list: {
                                    all: g_vars.thumb
                                },
                                industries: g_vars.thumb_industry_options,

                                hasNoImage: false,

                                onShow: function() {
                                    // Austin L. @NOTE: as json_encode() returns error_code=5 which means "Malformed UTF-8 characters, possibly incorrectly encoded",
                                    // just left the following description in a raw string.
                                    
                                    var formDescs = {
                                        mailinglistview: fn.phrasesBuild.build_thumb_desc_mailinglist,
                                        rssfeedview: fn.phrasesBuild.build_thumb_desc_rssfeed
                                        //mailinglistview: $phrases.build_thumb_desc_mailinglist,
                                        //rssfeedview: $phrases.build_thumb_desc_rssfeed
                                    };
                                    var lowerBaseRoute = baseRoute.toLowerCase();

                                    // Standard description
                                    var leftDesc = "Upload a custom thumbnail image.";
                                    //var leftDesc = $phrases.build_thumb_desc_standard;
                                    if (formDescs.hasOwnProperty(lowerBaseRoute)) {
                                        // Change to custom description
                                        leftDesc = formDescs[lowerBaseRoute];
                                    }

                                    this.$flyup.data("used_for", $li.data("route").toLowerCase());
                                    this.$flyup.find("p.left-form-desc").html(leftDesc);
                                },

                                onHidden: function() {
                                    $li.trigger("monitor");
                                }
                            });

                            // Mobile Header
                            $(".img-picker-mobile-header", $li).flyup({
                                name: "tab_header_phone",
                                category: "tab_header",
                                rows: 2,
                                devices: ["phone"],
                                dimension: {
                                    phone: g_vars.dimensions.tab_header.phone.thumb
                                },
                                list: {
                                    phone: g_vars.tab_header.phone
                                },
                                industries: g_vars.tab_header_industry_options,

                                onHidden: function() {
                                    $li.trigger("monitor");
                                },
                                onHide: function () {
                                    $li.trigger("monitor");
                                }
                            });

                            // Tablet Header
                            $(".img-picker-tablet-header", $li).flyup({
                                name: "tab_header_tablet",
                                category: "tab_header",
                                rows: 2,
                                devices: ["tablet"],
                                dimension: {
                                    tablet: g_vars.dimensions.tab_header.tablet.thumb
                                },
                                list: {
                                    tablet: g_vars.tab_header.tablet
                                },
                                industries: g_vars.tab_header_industry_options,
                                
                                onHidden: function() {
                                    $li.trigger("monitor");
                                }
                            });
                        }

                        // @added - May 18, 2016 - Douglas.
                        // fn.tabNav.$tabContent.completed();
                        try {
                            setTimeout(function() {

                                // fn.tabNav.$tabContent.completed();

                                setTimeout(function() {
                                    fn.tab.monitor();
                                }, 1000);

                                if(first_visit) {
                                    fn.helpInfo.$onboarding_build_btn.trigger('click');
                                }
                                for (var ii=0; ii<20; ii++) {
                                    setTimeout(function() {
                                        fn.tab.monitor();
                                    }, 1000 + 100* ii);
                                }

                            }, 1000);
                        } catch (err) {
                            fn.tabNav.$tabContent.completed();
                            console.log(err);
                        }

                        // @added - Sep 2, 2015 - Austin L.
                        plugin.init_selectbox({
                            selector: $li.find(".select2")
                        });

                        // Tab Label apply
                        fn.tab.reflectTabName();
                        fn.tab.setup_scrollspy(tab_cont_id);

                        // if ($.inArray(baseRoute, ['orderingView']) < 0) {
                        //     fn.tabNav.$tabContent.completed();
                        // }

                        setTimeout(function () {
                            // if current feature is ordering, then we are hiding BA spinner after initial category sync - Douglas
                            // if (baseRoute != 'orderingView') fn.tabNav.$tabContent.completed();
                            fn.tabNav.$tabContent.completed();
                        }, 3000);

                        /* event from ordering feature - Douglas */
                        $li.on('init_sync_done', function () {
                            fn.tabNav.$tabContent.completed();
                        });
                        // $li.trigger('init_load_done');
                        // setTimeout( function () {
                        //     $li.trigger('init_load_done');
                        // }, 300);

                        /*
                         __        ___  __           __          __
                        /  ` |__| |__  /  ` |__/    |__)  /\  | |__)
                        \__, |  | |___ \__, |  \    |    /~~\ | |  \
                        */
                        // Let's check again if this content is right for currenctly active tab in Tab Nav
                        fn.tabNav.showActiveTabContent();
                        fn.tab.monitor();


                    });
                    return;
                }

                fn.tab.deActivated();

                $tabBoardLiList.removeClass('active');
                $tabBoardLiList.filter('[data-key="' + (subRoute + '-' + tabId) + '"]').addClass('active');

                fn.tabNav.showActiveTabContent();
                fn.tab.activated();
                fn.tabNav.saveCurrentEditInCookie();
                fn.tab.monitor();
            },

            saveCurrentEditInCookie: function() {
                var $activeTab = fn.tabNav.getActiveTab();
                var tabId = $activeTab.data('tabId');
                var active_sub_route = $activeTab.find(".tab-body li.active").attr('data-route');

                $.cookie("build.tab.current_edit_tab", tabId);
                $.cookie("build.tab.current_edit_section", active_sub_route);
                $.cookie("build.tab.current_search", fn.tabNav.$search.find('input').val());
            },

            loadLastEdit: function() {
                /*
                var searchV = $.cookie("build.tab.current_search");
                if (searchV) {
                    fn.tabNav.$search.find('input').val(searchV);
                    fn.tabNav.search();
                }
                */

                if (fn.tabNav.$tabList.find('li.tab').length) {
                    var tabId = $.cookie("build.tab.current_edit_tab");
                    var sectionV = $.cookie("build.tab.current_edit_section");

                    fn.tabNav.loadTab({
                        tab_id: tabId,
                        sub_route: sectionV
                    });
                } else {
                    fn.tabNav.$tabBoards.children('li.no-content').addClass('active');
                }
            },

            showActiveTabContent: function () {
                var $activeTabLink = fn.tabNav.getActiveTab();
                var tabId = $activeTabLink.data('tabId');
                // var active_route = fn.core.data.tabs[tabId].baseRoute;
                var active_sub_route = $activeTabLink.find(".tab-body li.active").attr('data-route');

                $activeTabContent = fn.tabNav.$tabBoards.find('#' + active_sub_route + '_' + tabId);
                if ($activeTabContent.hasClass('active')) {
                    // already active? then do nothing...
                } else {
                    fn.tab.deActivated();
                    $activeTabContent.addClass('active').siblings().removeClass('active');
                    fn.tab.activated();
                    fn.tabNav.$tabContent.completed();
                }

                fn.tabNav.saveCurrentEditInCookie();

                if ($activeTabContent.length > 0) {
                    return true;
                } else {
                    return false;
                }

            },

            beforeLeaveTab: function(e, opts){
                var targetTabLink = $(opts.delegator).parents('li.tab').eq(0);
                // Should loop all sections to see if the content-change happened.
                var $activeTabLink = fn.tabNav.getActiveTab();
                var tabId = $activeTabLink.data('tabId');

                // As `tabId` maybe 0 for "more" tab, we should check whether it is "undefined" or not, instead of if(!$tabId)
                if (typeof tabId == "undefined") {
                    $(opts.delegator).trigger("positive_click");
                    return false;
                }

                if ($(targetTabLink).data('tabId') == tabId) {
                    $(opts.delegator).trigger("positive_click");
                    return false;
                }

                /* initialize settings for Save&Continue */
                fn.tab.event = null;
                fn.tab.opts = null;

                var feature_html = '<span class="feature-label">' + $activeTabLink.find('.tab-label').html() + '</span>';

                var globalChanged = false;
                var changed_section = '';
                var sections = [];

                fn.tabNav.resetTabIconColor();

                if (('icon' in fn.core.data.tabs[tabId].changed) && (fn.core.data.tabs[tabId].changed.icon)) {
                    // changed_section = changed_section + '<li class="one-line-ellipsis">' + $phrases['build_label_feature_icon'] + '</li>';
                    sections.push('<span class="section-name">' + $phrases.build_label_feature_icon + '</span>');
                    globalChanged = true;
                }

                fn.tabNav.$tabBoards.find("li[data-tab-id=" + tabId + "]").each(function(i, o){
                    var contentChangedFlag = $(o).triggerHandler("content_changed");
                    if (contentChangedFlag) {

                        globalChanged = true;

                        // var section_name = $(o).attr("sub-route");
                        // section_name = section_name.charAt(0).toUpperCase() + section_name.substring(1);
                        var section_name = $activeTabLink.find('ul.tab-body li.active').text();
                        sections.push('<span class="section-name">' + section_name + '</span>');

                        // changed_section = changed_section + '<li class="one-line-ellipsis">' + section_name + '</li>';
                    }
                });

                opts.leavingTabId = tabId;

                if (globalChanged) {
                    changed_section = sections.join(', ');
                    $(this.modal).trigger('updateCheckList', [
                        '<li class="one-line-ellipsis">' + changed_section + ' in the ' + feature_html + ' Feature' + '</li>',
                        fn.phrasesBuild.build_cfm_changed_section + ' :'//, 
                        // feature_html, 
                        // fn.phrasesBuild.build_cfm_changed_feature
                    ]);
                    return true;
                } else {
                    $(opts.delegator).trigger("positive_click");
                    return false;
                }

            },


            beforeLeaveSection: function(e, opts) {
                var $targetSubLink = $(opts.delegator);
                var $targetTabLink = $(opts.delegator).parents('li.tab').eq(0);
                if ($targetTabLink.hasClass("tab-more") && !fn.isCustomDesignEnabled()) {
                	return false;
                }

                // Should loop all sections to see if the content-change happened.
                var $activeTabLink = fn.tabNav.getActiveTab();
                var $subLink = $activeTabLink.find('.tab-body > li.active');
                var tabId = $activeTabLink.data('tabId');
                var subRoute = $subLink.attr('data-route');

                fn.tabNav.resetTabIconColor();

                // As `tabId` maybe 0 for "more" tab, we should check whether it is "undefined" or not, instead of if(!$tabId)
                if ((typeof tabId == "undefined") || (typeof subRoute == "undefined")) {
                    $(opts.delegator).trigger("positive_click");
                    return false;
                }


                if (($targetTabLink.data('tabId') == tabId) && ($targetSubLink.attr('data-route') == subRoute)) {
                    // $(opts.delegator).trigger("positive_click");
                    return false;
                }

                var $o = $('#' + subRoute + '_' + tabId);
                var contentChangedFlag = $o.triggerHandler("content_changed");

                if (contentChangedFlag) {
                    var section_name = '<span class="section-name">' + $subLink.text() + '</span>';
                    var feature_label = '<span class="feature-label">' + $activeTabLink.find('.tab-label').html() + '</span>';
                    $(this.modal).trigger('updateCheckList', [
                        '<li class="one-line-ellipsis">' + section_name + ' in the ' + feature_label + ' Feature' + '</li>',
                        fn.phrasesBuild.build_cfm_changed_section + ' :'//,
                        // '<li class="one-line-ellipsis">' +  + '</li>',
                        // fn.phrasesBuild.build_cfm_changed_feature
                    ]);
                    return true;
                } else {
                    $(opts.delegator).trigger("positive_click");
                    return false;
                }

            },

            selectTab: function (e, first) {

                var $tab = first ? fn.tabNav.$tabNav.find('li.tab').eq(0) : $(this).parents('li.tab');

                var tabBodyHeight = $tab.find('.tab-body > li').length * 40 + 20,
                    checked = $tab.find('.tab-header input[type=checkbox]')
                    $activeTabs = fn.tabNav.$tabNav.find('li.tab.active'),
                    $activeOpt = $tab.find('.tab-body > li.active'),
                    inactiveWrapHeight = fn.tabNav.$inactiveWrap.outerHeight(),
                    tabId = $tab.data('tabId');

                var tabData = fn.getTabData(tabId);
                if (!tabData) return;

                // Close flyup. - @Todo - Austin
                /*
                if (fn.flyup.tabIcon.$cancelBtn) {
                    fn.flyup.tabIcon.$cancelBtn.trigger('click');
                }*/
                if ($tab.is('.active')) {
                    return;
                }

                
                // Proceed inactive block.
                if (($activeTabs.parents('.inactive-tab-list-wrap').length)) { // If active tabs are in inactive zone
                    if (!$tab.parents('.inactive-tab-list-wrap').length) { // If selected tab is not in inactive zone
                        var newHeight = inactiveWrapHeight - tabBodyHeight;
                        if (newHeight < 42)  {
                            newHeight = 42;
                        }

                        fn.tabNav.fixMoreTabPosition(newHeight, true);
                        fn.tabNav.$inactiveWrap.animate({height: newHeight});
                        fn.tabNav.$inactiveWrap.children("ul.tab-list").animate({height: newHeight - 40});
                    }
                } else {
                    var newHeight = inactiveWrapHeight + tabBodyHeight;
                    if ($tab.parents('.inactive-tab-list-wrap').length) {
                        fn.tabNav.fixMoreTabPosition(inactiveWrapHeight + tabBodyHeight, true);
                        fn.tabNav.$inactiveWrap.animate({height: inactiveWrapHeight + tabBodyHeight});
                        fn.tabNav.$inactiveWrap.children("ul.tab-list").animate({height: newHeight - 40});
                    }
                }

                // Release the old tab selected.
                $activeTabs.not(".tab-more").find('.tab-body').stop().animate({height: 0}, function () {
                    /*
                    $activeTabs.removeClass('active');
                    $activeTabs.find('.tab-line').removeClass('active');
                    $activeTabs.find(".tab-body li").removeAttr("data-loaded"); // Austin added to enable <always-reload-concept>. [Wise-Way].
                    */
                });

                // Select the new active tab.
                $tab.not(".tab-more").find('.tab-line').addClass('active');
                $tab.not(".tab-more").find('.tab-body').stop().animate({height: tabBodyHeight}, function () {
                    // $tab.addClass('active');
                });

                // put some sign and needed processing... previous tab processing...
                $activeTabs.removeClass('active');
                $activeTabs.not(".tab-more").find('.tab-line').removeClass('active');
                $activeTabs.find(".tab-body li").removeAttr("data-loaded"); // Austin added to enable <always-reload-concept>. [Wise-Way].
                // Let's remove previous tab's conent & modals
                $activeTabs.find(".tab-body li").each(function(i, o){
                    var sub_route = $(o).attr('data-route');
                    var $tab_li = $(o).parents('li.tab').eq(0);
                    var tab_id = $tab_li.attr('data-tab-id');

                    var wrapper_id = tab_id + "_" + sub_route;
                    $('#' + wrapper_id, fn.tabNav.$tabBoards).remove();
                    $('.modal.' + wrapper_id).remove(); // Remove old modals for this tab
                });

                $tab.addClass('active');

                // @todo - Austin
                // fn.flyup.tabIcon.selectByTab(tabId);

                /*
                 __   ___ ___    ___       ___     __   __        ___  ___      ___
                / _` |__   |      |  |__| |__     /  ` /  \ |\ |   |  |__  |\ |  |
                \__> |___  |      |  |  | |___    \__, \__/ | \|   |  |___ | \|  |

                */

                // Get the content.
                if (!$activeOpt.length) {
                    $activeOpt = $tab.find('.tab-body > li:eq(0)');
                }

                $activeOpt.trigger('positive_click');

                // Update the helper link
                var $helperLink = fn.$pageHeader.find('.tooltip-link');
                $helperLink.attr('href', tabData.helperLink);
                $helperLink.find('.tooltip-link-label').text(tabData.helperLabel);
                fn.$pageHeader.find('.tooltip-box').removeClass('hidden');

                // Bind helper link for each tabs.
                //fn.$pageBody.find('.tab-info-helper-icon').attr('href', tabData.helperLink).removeClass('hidden');

                // Bind helper link for each tabs for new help info dropdown
                if ( !is_partner ) {
                    fn.$pageHeader.find('.btn-help-desk').attr('href', tabData.helperLink);
                }

                /* Show Walkthrough Tutorial For First visitors */
                fn.$pageHeader.find('.help-info-dropdown .dropdown-menu li a.help-info-onboarding').css("display", "block");

                // refresh the app previewer
                $('.btn-restart', this.$previewer).trigger('click');
            },

            beforeRemove: function () {
                var $checkedTabs = fn.tabNav.$tabNav.find('div.tab-header input[type=checkbox]:checked').parents('.tab');
                if (!$checkedTabs.length) {
                    return false;
                }

                $(this.modal).trigger('updateCheckList', [$.map($checkedTabs, function(tab) {
                    return '<li>' + $(tab).find('.tab-title').html() + '</li>';
                }).join('')]);
                return true;
            },

            remove: function () {
                var $checkedTabs = fn.tabNav.$tabNav.find('div.tab-header input[type=checkbox]:checked').parents('.tab'),
                    hasActive = false;

                // @todo - Austin
                //fn.flyup.tabIcon.$cancelBtn.trigger('click');
                fn.tabNav.$removeTabBtn.attr('disabled', true);
                $.map($checkedTabs, function (tab) {
                    var $tab = $(tab), tabId = $tab.attr('data-tab-id');

                    fn.setTabChanged(tabId, "remove", true);
                    if ($tab.is('.active')) {
                        hasActive = true;
                    }
                    $tab.remove();

                    // fn.tabNav.$tabBoards.find('> li[data-tab-id="' + tabId + '"]').remove();
                    // Should remove modal data, too, to avoid dropzone re-allocated,
                    // because modals are added out of container
                    $.each(fn.tabNav.$tabBoards.children('li[data-tab-id="' + tabId + '"]'), function(i, o){
                        var mids = $(o).data('bams');
                        if (mids) {
                            for (var mind=0; mind<mids.length; mind++) {
                                while ($('#' + mids[mind]).length) {
                                    $('#' + mids[mind]).remove();
                                }
                            }
                        }
                        $(o).remove();
                    });

                });
                fn.tabNav.resizeInactiveTabList();
                if (hasActive) {
                    fn.tabNav.$tabBoards.children('li.no-content').addClass('active');

                    // Update the helper link
                    var $helperLink = fn.$pageHeader.find('.tooltip-link');
                    $helperLink.attr('href', '#');
                    $helperLink.find('.tooltip-link-label').text();
                    fn.$pageHeader.find('.tooltip-box').addClass('hidden');

                    fn.tab.$save.hide();

                }
                fn.tabNav.monitor();
                fn.helpInfo.checkOnboardingAvailable();
            },

            choose: function () {
                var $selectedTabs = fn.tabNav.$tabNav.find('div.tab-header input[type=checkbox]:checked').parents('.tab'),
                    hasSelected = $selectedTabs.length;

                if (hasSelected) {
                    fn.tabNav.$removeTabBtn.removeAttr('disabled');
                    fn.core.data.selectedTabs = $.map($selectedTabs, function (itm, idx) {
                        return $(itm).data('tab-id');
                    }).join(',');
                } else {
                    fn.core.data.selectedTabs = ''; // Not needed, but track changes.
                    fn.tabNav.$removeTabBtn.attr('disabled', true);
                }
            },

            monitor: function () {
                var k;

                var changed = false, icon_changed = false;
                var $tabLists = fn.tabNav.$tabNav.find('.tab-list');

                if (!fn.tabNav.$tabList.find('li.tab').length) {
                    fn.tabNav.$tabList.addClass('no-tabs');
                } else {
                    fn.tabNav.$tabList.removeClass('no-tabs');
                }

                $.each($tabLists.find('li.tab'), function (idx, tab) {
                    var $tab = $(tab);
                    var tabId = $tab.data('tabId');
                    var tabData = fn.getTabData(tabId);
                    var $activeTogglebox = $tab.find('.togglebox');
                    var isActived = $activeTogglebox.data('checked') ? 1 : 0;

                    if (!tabData) return true;

                    // Check seq.
                    if (idx != tabData.seq) {
                        changed = true;
                        // fn.setTabField(tabId, "seq", idx); // Austin commented, which causes [state reflect] incorrect
                        fn.setTabChanged(tabId, "seq", true);
                    } else {
                        fn.setTabChanged(tabId, "seq", false);
                    }

                    // Check active status.
                    if (isActived != tabData.active) {
                        changed = true;
                        // fn.setTabField(tabId, "active", isActived); // Austin commented, which causes [state reflect] incorrect
                        fn.setTabChanged(tabId, "active", true);
                    } else {
                        fn.setTabChanged(tabId, "active", false);
                    }
                });

                $.each(fn.core.data.tabs, function (tabId, tab) {
                    if (tab.changed) {
                        for(k in tab.changed) {
                            if (tab.changed[k]) {
                            changed = true;
                                if (k == "icon") icon_changed = true;
                            }
                            break;
                        }
                    }

                    if (changed) {
                        return false;
                    }
                });

                // once change(order and active) is made, just do save
                if (changed) {
                    fn.tab.save_tab_meta();
                }

                if (icon_changed) {
                    fn.tab.$save.removeAttr('disabled');
                } else {
                    fn.tab.$save.attr('disabled', true);

                    // check if tab content is changed
                    fn.tab.monitor();
                }

            },

            /* Updated by Douglas 20160130 */
            // only_icon: true (check only tab icon changes), false (check all tab changes)
            isChanged: function (only_icon) {
                if (only_icon == undefined) only_icon = false;

                var changed = false, icon_changed = false;
                var tab, tabId, k;

                for(tabId in fn.core.data.tabs) {
                    tab = fn.getTabData(tabId);
                    if (tab.changed) {
                        for(k in tab.changed) {
                            if (tab.changed[k]) {
                            changed = true;
                                if (k == 'icon') icon_changed = true;
                            break;
                            }
                        }
                    }

                    if (only_icon) {
                        if (icon_changed) break;
                    } else {
                        if (changed) break;
                    }
                }

                return (only_icon ? icon_changed : changed);
            },

            grabChanges: function () {

                var $tabLists = fn.tabNav.$tabNav.find('.tab-list');

                $.each($tabLists.find('li.tab'), function (idx, tab) {
                    var $tab = $(tab);
                    var tabId = $tab.data('tabId');
                    var    $activeTogglebox = $tab.find('.togglebox');

                    fn.setTabField(tabId, "seq", idx);
                    fn.setTabField(tabId, "active", $activeTogglebox.data('checked') ? 1 : 0);
                });
            },

            getChanges: function (except_for_icon) { // Only to be called just before Save. In order to check if changed, use isChanged function.
                var gChanged = false,
                    changedTabs = {};

                // Read changed state from NabList HTML objs
                fn.tabNav.grabChanges();

                $.each(fn.core.data.tabs, function (tabId, tab) {
                    if (tab.changed) {
                        var changed = false;
                        $.each (tab.changed, function (key, val) {
                            if (except_for_icon && (key=='icon')) return true; // skip for icon changes
                            changed = true;
                        });
                        if (changed) {
                            changedTabs[tabId] = fn.getTabData(tabId);
                            gChanged = true;
                        }
                    }
                });

                if (gChanged) {
                    return changedTabs;
                }

                return false;
            },

            removeIconChanges: function () {
                $.each(fn.core.data.tabs, function (tabId, tab) {
                    if (tab.changed && tab.changed.icon) {

                        fn.core.data.tabs[tabId]['iconColor'] = fn.core.data.tabs[tabId]['old_icon']['iconColor'];
                        fn.core.data.tabs[tabId]['iconKey'] = fn.core.data.tabs[tabId]['old_icon']['iconKey'];
                        fn.core.data.tabs[tabId]['iconUrl'] = fn.core.data.tabs[tabId]['old_icon']['iconUrl'];

                        var $activeTab = fn.tabNav.$tabNav.find('li[data-tab-id=' + tabId + ']');
                        $activeTab.find('.tab-icon-main').attr({
                            src: fn.core.data.tabs[tabId]['iconUrl'],
                            'data-src': fn.core.data.tabs[tabId]['iconUrl']
                        }).end()
                        .find(".tab-icon-shadow").attr({
                            src: plugin.replaceSvgColor(fn.core.data.tabs[tabId]['iconUrl'], config.iconShadowColor)
                        });

                        delete fn.core.data.tabs[tabId].changed.icon;
                    }
                });

                fn.tabNav.monitor();
            }
        },

        /* Modals */
        modal: {
            addTab: {
                timer: null,
                interval: 4000,

                $modal: null,
                $step1: null,
                $step2: null,
                $search: null,
                $tabList: null,
                $tabItems: null,
                $tabView: null,
                $tabDetail: null,
                $tabHelperLink: null,
                $noTabMatched: null,
                $choose: null,
                $back: null,
                $done: null,
                $name: null,

                init: function () {
                    fn.modal.addTab.$modal = $('.modal-add-tab');

                    fn.modal.addTab.$step1 = fn.modal.addTab.$modal.find('.modal-body .add-tab-step-1');
                    fn.modal.addTab.$step2 = fn.modal.addTab.$modal.find('.modal-body .add-tab-step-2');

                    fn.modal.addTab.$search = fn.modal.addTab.$step1.find('.tab-search');
                    fn.modal.addTab.$tabList = fn.modal.addTab.$step1.find('.tab-list');
                    fn.modal.addTab.$noTabMatched = fn.modal.addTab.$tabList.find('.no-tab-matched');

                    fn.modal.addTab.$tabView = fn.modal.addTab.$step1.find('.tab-phone-view');
                    fn.modal.addTab.$tabDetail = fn.modal.addTab.$step1.find('.tab-detail');
                    fn.modal.addTab.$tabHelperLink = fn.modal.addTab.$step1.find('.tab-helper-link');
                    fn.modal.addTab.$choose = fn.modal.addTab.$modal.find('.btn-choose');

                    fn.modal.addTab.$name = fn.modal.addTab.$step2.find('.tab-name');
                    fn.modal.addTab.$back = fn.modal.addTab.$modal.find('.btn-back');
                    fn.modal.addTab.$done = fn.modal.addTab.$modal.find('.btn-done');

                    // Load data.
                    fn.modal.addTab._load();

                    /***** Step 1 *****/
                    // Search
                    fn.modal.addTab.$search.find('.icon-tab-search').on('click', fn.modal.addTab.search);
                    fn.modal.addTab.$search.find('input').on('keyup', fn.modal.addTab.search);
                    // TabList
                    $("#tab_type_list").on('click', 'li', fn.modal.addTab.choose);
                    // Choose
                    fn.modal.addTab.$choose.on('click', fn.modal.addTab.step);
                    /***** Step 2 *****/
                    // Name
                    fn.modal.addTab.$name.on('focus', function () {
                        $(this).siblings('.msg').remove();
                    }).on('keyup', function () {
                        $(this).siblings('.msg').remove();
                        var yourTabName = escapeHtml($(this).val());
                        fn.modal.addTab.$step2.find('.tab-label > div.your-input').html(yourTabName);
                    });
                    // Back
                    fn.modal.addTab.$back.on('click', function () {
                        fn.modal.addTab.$name.val('');
                        fn.modal.addTab.step();
                    });
                    // Done
                    fn.modal.addTab.$done.on('click', fn.modal.addTab.done);
                },

                _load: function () {
                    var html = '';
                    if (fn.core.data.viewControllers) {
                        // console.log(fn.core.data.viewControllers);
                        
                        $.each(fn.core.data.viewControllers, function(key, data) {
                            //console.log(data.imgName);
                            html += '<li data-view-controller="' + data.name + '">';
                            if (is_wl_release) {
                                // Active icon
                                html += '<span class="tab-icon">';
                                html += '<img class="active-icon" src="/global/svg.php?filename=' + data.imgName + '.svg&sub_dir=whitelabel/add_feature&color=' + partner_theme.hover_over_active_color +'">';

                                // Inactive icon
                                html += '<img class="inactive-icon" src="/global/svg.php?filename=' + data.imgName + '.svg&sub_dir=whitelabel/add_feature&color=bbb">';
                                html += '</span>';                                
                            } else {
                                html += '<i class="iconba tab-icon icon-' + data.imgName + '"></i>'
                            }
                            html += '<span>' + data.label + '</span>'
                                + '<img class="hide" src="' + siteUrl + asset + '/images/pages/base/edit/build/tabview/' + data.imgName + '.png?v=' + version + '">'
                                + '</li>';
                        });
                    }

                    $('ul#tab_type_list').html(html);
                },

                reset: function () {
                    fn.modal.addTab.$modal.find('.add-tab-step-1').removeClass('hidden');
                    fn.modal.addTab.$modal.find('.add-tab-step-2').addClass('hidden');
                    fn.modal.addTab.$search.find('input').val('');
                    fn.modal.addTab.search();
                    fn.modal.addTab.$name.val('');
                    clearInterval(fn.modal.addTab.timer);
                },

                done: function () {
                    var $active = fn.modal.addTab.$tabList.children("ul").children("li.active:not(.hidden)");
                    var viewControllerName = $active.attr('data-view-controller');
                    var name = fn.modal.addTab.$name.val();
                    var safeName = safeText(name);
                    var noFeatureTabNav = $('.tab-nav', '.block-content.no-feature');
                    var noFeatureTabContent = $('.tab-content', '.block-content.no-feature');
                    var noFeatureContent = $('.block-content.no-feature');
                    var featureContent = $('.block-content.feature');
                    if (name != safeName) {
                        fn.modal.addTab.$name.val(safeName).trigger("keyup");
                        name = safeName;
                    }

                    if (!$active.length) {
                        fn.modal.addTab.step();
                        return;
                    }

                    if (!name) {
                        fn.modal.addTab.$name.focus().parent().append('<div class="msg right error">'+fn.phrasesBuild.msgFieldRequired+'</div>');
                        return;
                    }

                    var viewController;
                    if (fn.core.data.viewControllers[viewControllerName]) {
                        viewController = fn.core.data.viewControllers[viewControllerName];
                    }

                    // Add tab.
                    var tab_create_data = {
                        viewController: $active.attr('data-view-controller'),
                        baseRoute: viewController.baseRoute,
                        tabLabel: name,
                        desc: viewController.desc,
                        iconKey: '',
                        iconUrl: siteUrl + '/images/theme_editor/no_button.png?v=' + version,
                        seq: fn.tabNav.maxOrder,
                        helperLabel: viewController.linkLabel,
                        helperLink: viewController.link,
                        active: 1
                    };

                    fn.tabNav.maxOrder = fn.tabNav.maxOrder + 1;


                    // fn.$pageBody.started();
                    fn.modal.addTab.$modal.started(1, {from: {opacity: 0}, to: {opacity: 0.8}});

                    // Now fire ajax request to the server to create new tab
                    ajax.post('build.create_tab', {tab: tab_create_data}, function (json) {

                        fn.modal.addTab.$modal.completed();

                        if (!json.success) {
                            notify.error(json.msg);
                            fn.modal.addTab.$back.trigger("click");
                            return;
                        }

                        // Update tab navigation.
                        if (json.data) {
                            // now lets add newly created tab into the tab nav
                            var tabData = {
                                tabId: json.data.tab_id,
                                changed: {},
                                viewController: json.data['view_controller'],
                                baseRoute: json.data['base_route'],
                                isSupportCedar: json.data['is_support_cedar'],
                                isV2: json.data['is_v2'],
                                tabLabel: json.data['tab_label'],
                                desc: json.data['vc_desc'],
                                iconColor: json.data['tab_icon_color'],
                                iconKey: '',
                                iconUrl: siteUrl + '/images/theme_editor/no_button.png?v=' + version,
                                seq: json.data['seq'],
                                helperLabel: json.data['helper_label'],
                                helperLink: json.data['helper_link'],
                                abbr: json.data['abbr'],
                                active: 1,
                            };

                            fn.setTabData(json.data.tab_id, tabData);

                            var $newTabLi = fn.tabNav.addTab(tabData);

                            /*fn.tabNav.loadTab({
                                tab_id: 0
                            });*/

                            // apply search filtering
                            fn.tabNav.search();

                            // fn.modal.addTab.reset();
                            fn.modal.addTab.$modal.modal('hide');

                            noFeatureTabNav.removeClass('hide');
                            noFeatureContent.addClass('hide');
                            //noFeatureTabContent.removeClass('no-feature');
                            featureContent.removeClass('hide');

                            fn.tabNav.bindBeforeLeave();

                            fn.tabIcon.init($newTabLi.find(".tabicon-picker"));

                            var $lis = fn.tabNav.$tabList.find('li.tab');
                            if ($lis.length == 1) {
                                $lis.filter(':first').find('.select-tab').trigger('click');
                            }

                            notify.success(json.msg);
                            fn.helpInfo.checkOnboardingAvailable();
                        }

                        /*
                        if (!tabId) {
                            return;
                        }
                        fn.tabNav.$tabList.find('> li[data-tab-id="' + json.id + '"] .tab-header .tab-title .tab-name').html(json.tab_name);
                        $tab.find('input#tab_name').attr({'data-val': json.tab_name});
                        $tab.trigger('updateContent', json);
                        // Austin add this here...
                        fn.tab.monitor();
                        */

                    });


                    /*
                    // Legacy code - this logic is used to save added tab just when to click [Save] button
                    var tabId = 'sketch_' + fn.core.data.newTabId;
                    fn.setTabData(tabId, {
                        tabId: tabId,
                        changed: {
                            add: true
                        },
                        viewController: $active.attr('data-view-controller'),
                        baseRoute: viewController.baseRoute,
                        tabLabel: name,
                        desc: viewController.desc,
                        iconKey: '',
                        iconUrl: siteUrl + '/images/theme_editor/no_button.png?v=' + version,
                        seq: fn.tabNav.$tabList.find('> li.tab').length,
                        helperLabel: viewController.linkLabel,
                        helperLink: viewController.link,
                        active: 1
                    });

                    // Add new tab to the tab nav.
                    fn.tabNav.addTab(fn.getTabData(tabId));
                    fn.modal.addTab.reset();
                    fn.modal.addTab.$modal.modal('hide');
                    fn.tabNav.monitor();
                    */
                },

                step: function () {
                    var $active = fn.modal.addTab.$tabList.children("ul").children("li.active:not(.hidden)");
                    var viewControllerName = $active.attr('data-view-controller');
                    var viewController;

                    if (fn.core.data.viewControllers[viewControllerName]) {
                        viewController = fn.core.data.viewControllers[viewControllerName];
                    }

                    fn.modal.addTab.$modal.find('.add-tab-step-1, .add-tab-step-2').toggleClass('hidden');

                    if (fn.modal.addTab.$modal.find('.add-tab-step-1').is('.hidden')) {
                        fn.modal.addTab.$step2.find(".tab-label")
                            .children("div.your-input").html('').end()
                            .children("div.tab-type").html(viewController.desc);

                        // ----------------------------------------------------------------------
                        // Install Preview accordingly
                        // ----------------------------------------------------------------------
                        $('.tab-nav-screenshot ul', fn.modal.addTab.$step2).html('');

                        var section_list = fn.core.data.tab_opts['default'];
                        if (viewController['baseRoute'] in fn.core.data.tab_opts['custom']) {
                            section_list = fn.core.data.tab_opts['custom'][viewController['baseRoute']];
                        }

                        for (var kv in section_list) {
                            if (section_list[kv]['has']) {
                                $('.tab-nav-screenshot ul', fn.modal.addTab.$step2).append('<li><div class="tab-radio"></div><span>' + section_list[kv]['label'] + '</span></li>');
                            }
                        }
                        // ----------------------------------------------------------------------


                        fn.modal.addTab.$name.focus();

                    } else {
                        fn.modal.addTab.$search.find('input').focus();
                    }

                },

                reloadViewControllers: function (e) {

                    fn.modal.addTab.render();
                    fn.modal.addTab.$modal.started(1, {
                        from: {opacity: 1},
                        to: {opacity: 0.8}
                    });

                    ajax.post('build.load_view_controlllers', {}, function (json) {

                        fn.modal.addTab.$modal.completed();

                        // Set view controllers data.
                        if (json.view_controllers) {
                            $.map(json.view_controllers, function (viewController) {
                                if (viewController.visible) {
                                    fn.core.data.viewControllers[viewController.name] = {
                                        name: viewController.name,
                                        baseRoute: viewController.base_route,
                                        label: viewController.proc_label,
                                        desc: viewController.description,
                                        detail: viewController.detail,
                                        imgName: viewController.proc_img_name,
                                        link: viewController.link,
                                        linkLabel: viewController.link_label
                                    };
                                }
                            });

                            fn.modal.addTab.render();
                        }

                    });

                },

                render: function ($tab) {
                    var $tabs = $("ul#tab_type_list").children("li").filter(':not(.hidden)'),
                        $active = $tabs.filter('.active'),
                        viewControllerName, viewControllerData,
                        noTabs = $tabs.length ? false : true;

                    fn.modal.addTab.$choose.removeAttr('disabled');
                    if (!$tab && $active.length) {
                        fn.modal.addTab.$tabView.removeClass('hidden');
                        fn.modal.addTab.$tabDetail.removeClass('hidden');
                        fn.modal.addTab.$tabHelperLink.removeClass('hidden');
                        return;
                    }

                    if (noTabs) {
                        fn.modal.addTab.$tabView.addClass('hidden');
                        fn.modal.addTab.$tabDetail.addClass('hidden');
                        fn.modal.addTab.$tabHelperLink.addClass('hidden');
                        fn.modal.addTab.$choose.attr('disabled', true);
                        return;
                    }

                    fn.modal.addTab.$tabView.removeClass('hidden');
                    fn.modal.addTab.$tabDetail.removeClass('hidden');
                    fn.modal.addTab.$tabHelperLink.removeClass('hidden');
                    if (!$tab) {
                        $tab = $tabs.eq(0);
                    }

                    $("ul#tab_type_list").children('li').removeClass('active');
                    $tab.addClass('active');

                    // Get the view controller name.
                    viewControllerName = $tab.attr('data-view-controller');

                    if (!fn.core.data.viewControllers[viewControllerName]) { // No data?
                        return;
                    }
                    viewController = fn.core.data.viewControllers[viewControllerName];

                    var img = '<div class="view-img view-img-show" style="background: url(' + siteUrl + asset + '/images/pages/base/edit/build/tabview/' + viewController.imgName + '.png?v=' + version + ')"></div>';
                    var img_hidden = '<div class="view-img" style="background: url(' + siteUrl + asset + '/images/pages/base/edit/build/tabview/' + viewController.imgName + '_alt.png?v=' + version + ')"></div>';
                    fn.modal.addTab.$tabView.html(img + img_hidden);

                    fn.modal.addTab.$tabDetail.html('<div class="tab-label">' + viewController.label + '</div><div class="tab-desc">' + viewController.detail + '</div>');

                    // Set timer.
                    clearInterval(fn.modal.addTab.timer);
                    fn.modal.addTab.timer = setInterval(function () {
                        var $active = $("ul#tab_type_list").children('li.active'),
                            $imgs = fn.modal.addTab.$tabView.find('.view-img');

                        if ($active.length && $imgs.length) {
                            $imgs.toggleClass('view-img-show');
                        }
                    }, fn.modal.addTab.interval);
                    
                    // Update tab helper link
                    if ( !is_partner ) {
                        fn.modal.addTab.$tabHelperLink.attr('href', viewController.link);
                    }
                },

                choose: function () {
                    fn.modal.addTab.render($(this));
                },

                search: function () {
                    var needle = fn.modal.addTab.$search.find('input').val().toLowerCase(),
                        noTabMatched = true;

                    if (!needle) {
                        $("ul#tab_type_list").children('li').removeClass('hidden');
                        fn.modal.addTab.$noTabMatched.addClass('hidden');
                        fn.modal.addTab.render();
                        return;
                    }

                    $("ul#tab_type_list").children('li').each(function (idx, itm) {
                        var haystack = $(itm).children('span').html().toLowerCase();

                        if (haystack.indexOf(needle) != -1) {
                            $(itm).removeClass('hidden');
                            noTabMatched = false;
                        } else {
                            $(itm).addClass('hidden');
                        }
                    });

                    fn.modal.addTab.$noTabMatched.toggleClass('hidden', !noTabMatched);
                    fn.modal.addTab.render();
                }
            }
        },

        /* Tab */
        tab: {
            $save: null,
            tabIdStore: null,
            tabIdList: [],

            init: function () {
                fn.tab.$save = $('.page-header .btn-toolbar .btn-save');

                fn.tab.$save.on('click', fn.tab.save);
                fn.tabNav.$tabBoards
                    .on('change keyup', '> li.active input[name]', fn.tab.monitor)
                    .on('change', '> li.active select[name]', fn.tab.monitor)
                    .on('change keyup', '> li.active textarea[name]', fn.tab.monitor)
                    .on('closeFlyups', '> li', fn.flyup.closeOtherFlyups);

                /*
                     .on('keyup', ' input[name=tab_name]', fn.tab.reflectTabName)
                    .on('monitor', '> li', fn.tab.monitor)
                    .on('content_changed', '> li', fn.tab.my_content_changed)
                */

                // If changed tab count is more than 5,we should the informative popup when loading the page.
                if ($.cookie('changed_tab_count') > 4 && !$.cookie('show_informative_dialog')) {
                    fn.tab.showInfomativeDialog();
                }
            },

            init_scrollspy: function (nav_html) {
                var s_cont = 'body .wrapper .content';
                var s_sub = ' .block-content .tab-content';
                if ($('#nav_shadow_for_scrollspy').length < 1) {
                    $(s_cont + s_sub).append('<nav id="nav_shadow_for_scrollspy" style="display: none;" class="nav_shadow"><ul class="nav nav-pills"></ul></nav>');
                }
                $('#nav_shadow_for_scrollspy > ul.nav').html(nav_html);

                $(s_cont).scrollspy({
                    target: '#nav_shadow_for_scrollspy',
                    offset: 80
                });

                $('#nav_shadow_for_scrollspy').on("activate.bs.scrollspy", function(){
                    var currentItem = $(s_cont + s_sub + ' .nav_shadow li.active > a').attr('href');
                    $(currentItem).addClass('active').siblings().removeClass('active');
                });


                $(s_cont).each(function(){
                    $(this).scrollspy('refresh');
                });

            },

            setup_scrollspy: function (wrapper_selector_id) {

                /*
                plugin.setupScrollSpy('body .wrapper .content', {
                    // container: 'body .wrapper .content .block-content .tab-content', // will keep ScrollSpyCenter - <nav>
                    container: 'body', // will keep ScrollSpyCenter - <nav>
                    spy_id: 'nav_shadow_for_scrollspy', // ScrollSpyCenter id = <nav> 's id
                    section: '.section', // watching target selector
                    section_id_prefix: wrapper_selector_id, // watching target selector's id pattern
                    section_container: '#' + wrapper_selector_id,
                    section_active_class: 'active',
                    scroll_offset: 150   // should be changed much larger...
                });
                */

                plugin.setupBizScrollSpy('body > .wrapper > .content', {
                    section_container: '#' + wrapper_selector_id,
                    scroll_offset: 300 // should be changed much larger...
                });


                /*
                var section_id_list = [];
                var wrapper = $('#' + wrapper_selector_id);

                $(wrapper).find('.section').each(function(i, o){
                    var attr = $(o).attr("id");
                    if (typeof attr !== typeof undefined && attr !== false) {
                        section_id_list.push(attr);
                    } else {
                        var section_id = wrapper_selector_id + '-section-' + i;
                        $(o).attr('id', section_id);
                        section_id_list.push(section_id);
                    }
                });

                var nav_html = '';
                for (var i=0; i<section_id_list.length; i++) {
                    nav_html = nav_html + '<li><a href="#' + section_id_list[i] + '">Section-' + i + '</a></li>';
                }
                if (section_id_list.length > 0) $('#' + section_id_list[0]).addClass('active');

                fn.tab.init_scrollspy(nav_html);
                */
            },

            onUpdateFlyupAgent: function() {
                fn.tab.updateFlyupAgent($(this));
                fn.tab.updateFlyupAgent('.' + $(this).attr('id'));
                $(this).triggerHandler('updatePreviewer');
            },

            onEmojiSetup: function(e, data) {
                $(data.selector, $(this)).each(function(i, o){
                    var html = $(o).html().trim().replace(/\n/g, '<br/>');
                    $(o).html(emoji.unifiedToHTML(html));
                });
            },

            updateFlyupAgent: function($wrapper) {

                $('.img-picker', $wrapper).each(function(i, o){

                    $('.iconba', $(o)).remove();
                    $(o).append('<i class="iconba icon-green-circle"></i>');

                    // In build page, only 3 types of agents are existing: Thumb, TabHeader-Phone, TabHeader-Tablet
                    // And there is also another type tab_icon for Loyalty / Gauge Icon
                    var idv_ref = '';
                    var type = '';
                    var flyup_category = '';

                    var jflyup = $(o).data("jflyup");

                    if (typeof jflyup !== "undefined") {
                        flyup_category = jflyup.config.category;
                        flyup_tab_type = jflyup.getActiveTabType();
                    }

                    if (flyup_category == "tab_icon") {
                        type = "tab_icon";
                        idv_ref = $(o).attr("data-element");
                    } else {
                        var agentType = {
                            'loc-l': ['loc', '-loc-left'],
                            'loc_r':['loc', '-loc-right'],
                            'phone': ['tab-header', '-phone'],
                            'tablet':['tab-header', '-tablet'],
                            'product': ['product', '-product'],
                            'thumb': ['thumb', '']
                        };

                        for (k in agentType) {
                            idv_ref = $(o).attr('data-element' + agentType[k][1]);
                            if (!((idv_ref == undefined) || (idv_ref == ''))) {
                                type = k;
                                break;
                            }
                        }
                    }

                    // For preview image part...
                    if (type != '') {

                        // First add state to the agent-icon
                        var is_value_set = false;
                        var id_ref_val = $(idv_ref).val();
                        if ( typeof id_ref_val != "undefined" && !$.isEmptyObject(id_ref_val) && id_ref_val !="" && id_ref_val != "g_no_image" && id_ref_val != "g_no_header" && id_ref_val != "d_contact-tab" && id_ref_val != "d_aroundus" && id_ref_val != "d_rss" && id_ref_val != "no_bg_phone") {
                            is_value_set = true;
                        }

                        // Getting flyup tab type from image id
                        if (id_ref_val.indexOf('g_') != 0)
                            flyup_tab_type = "custom";
                        else
                            flyup_tab_type = "lib";

                        $(o).toggleClass('has_value_set', is_value_set);

                        var $previewer = $($(o).attr('previewer'));

                        // Add Preview Images - actually div...
                        // following is just for header image
                        if ($previewer.length > 0) {

                            var app_code = $('#app_code_4flyupagent').val();
                            var is_based_filename = true;

                            var url = $(idv_ref).data("url");
                            if (url == undefined) url = '';
                            if ($(idv_ref + '_link').length > 0) {
                                url = $(idv_ref + '_link').val();
                                is_based_filename = false;
                            }


                            var filename = $(idv_ref + '_filename').val();
                            if (filename == undefined) filename = $(idv_ref).data("filename");
                            if (filename == undefined) filename = $(idv_ref).attr("data-filename");
                            if (filename == undefined) filename = '';


                            // if image id value is not set, url, filename should be ignored
                            if (!is_value_set) {
                                filename = '';
                                url = '';
                            }

                            // if filename is set, just ignore data('url') as it might not be refreshed accordingly
                            if (is_based_filename && (filename != '')) {
                                url = '';
                            }

                            if (type == "tab_icon") {
                                /* Loyalty / Gauge icon */
                                var styleStr = '';
                                if (!url) {
                                    url = $(idv_ref).data("realUrl");
                                }

                                if (url != '') {
                                    styleStr = 'background-image: url(\'' + url + '\');';
                                }

                                $previewer.addClass('preview-for-thumb')
                                    .find('.thumb-in-preview').remove().end()
                                    .append('<div class="thumb-in-preview" style="' + styleStr + '"></div>');

                            } else if (agentType[type][0] == 'thumb') {

                                // if (url == '') url = '/images/theme_editor/no_button.png';
                                var styleStr = '';

                                if ((url == '') && (filename != '')) {
                                    if (flyup_tab_type == "custom") {
                                        url = '/custom_images/' + app_code + '/templates/thumbs/' + filename + '?width=50&height=50&a=wh';
                                    } else if (flyup_tab_type == "lib") {
                                        url = '/images/templates/thumbs/' + filename;
                                    }
                                } 
                                if ((url == '') && ($($(o).attr('data-alternate')).length > 0) && ($($(o).attr('data-alternate')).val() != '')) url = $($(o).attr('data-alternate')).val();
                                if ((url == '') && ($(o).attr('data-default-icon') != undefined) && ($(o).attr('data-default-icon') != '')) url = $(o).attr('data-default-icon');
                                if (url != '') styleStr = 'background-image: url(\'' + url + '\');';

                                $previewer.addClass('preview-for-thumb')
                                    .find('.thumb-in-preview').remove().end()
                                    .append('<div class="thumb-in-preview" style="' + styleStr + '"></div>');

                                $thumb_viewer = $(o).siblings('.thumb-preview').find('img');
                                if ($thumb_viewer != undefined) {
                                    $thumb_viewer.attr('src', url);
                                }

                            } else if (agentType[type][0] == 'product') {

                                // if (url == '') url = '/images/theme_editor/no_button.png';
                                var styleStr = '';

                                if ((url == '') && (filename != '')) {
                                    if (flyup_tab_type == "custom") {
                                        url = '/custom_images/' + app_code + '/templates/products/' + filename + '?width=50&height=50&a=wh';
                                    } else if (flyup_tab_type == "lib") {
                                        url = '/images/templates/products/' + filename;
                                    }
                                }

                                // if ((url == '') && (filename != '')) url = '/custom_images/' + app_code + '/templates/products/' + filename + '?width=50&height=50&a=wh';
                                if ((url == '') && ($($(o).attr('data-alternate')).length > 0) && ($($(o).attr('data-alternate')).val() != '')) url = $($(o).attr('data-alternate')).val();
                                if ((url == '') && ($(o).attr('data-default-icon') != undefined) && ($(o).attr('data-default-icon') != '')) url = $(o).attr('data-default-icon');
                                if (url != '') styleStr = 'background-image: url(\'' + url + '\');';


                                $previewer.addClass('preview-for-thumb')
                                    .find('.thumb-in-preview').remove().end()
                                    .append('<div class="thumb-in-preview" style="' + styleStr + '"></div>');

                            } else if (agentType[type][0] == 'tab-header') {

                                var styleStr = '';

                                if ((url == '') && (filename != '')) {
                                    if (flyup_tab_type == "custom") {
                                        url = '/custom_images/' + app_code + '/templates/tab_headers/' + type + '/' + filename;
                                    } else if (flyup_tab_type == "lib") {
                                        url = '/images/templates/tab_headers/' + type + '/' + filename;
                                    }
                                }
                                if ((url == '') && ($($(o).attr('data-alternate')).length > 0) && ($($(o).attr('data-alternate')).val() != '')) url = $($(o).attr('data-alternate')).val();
                                if ((url == '') && ($(o).attr('data-default-icon') != undefined) && ($(o).attr('data-default-icon') != '')) url = $(o).attr('data-default-icon');
                                if (url != '') styleStr = 'background-image: url(\'' + url + '\');';


                                $previewer.addClass('preview-for-tabheader')
                                    .find('.device-' + type).remove().end()
                                    .append('<div class="device-spec device-' + type + '" style="' + styleStr + '"></div>');

                            } else if (agentType[type][0] == 'loc') {

                                var styleStr = '';
                                var timestamp = parseInt(new Date().getTime() / 1000);
                                
                                if ((url == '') && (filename != '')) {
                                    if (flyup_tab_type == "custom") {
                                        url = '/custom_images/' + app_code + '/location/' + filename + '?width=100&height=100&a=wh&token=' + timestamp;
                                    } else if (flyup_tab_type == "lib") {
                                        url = '/images/templates/locations/' + filename;
                                    }
                                }
                                // if ((url == '') && (filename != '')) url = '/custom_images/' + app_code + '/location/' + filename + '?width=100&height=100&a=wh&token=' + timestamp;
                                if ((url == '') && ($($(o).attr('data-alternate')).length > 0) && ($($(o).attr('data-alternate')).val() != '')) url = $($(o).attr('data-alternate')).val();
                                if ((url == '') && ($(o).attr('data-default-icon') != undefined) && ($(o).attr('data-default-icon') != '')) url = $(o).attr('data-default-icon');
                                if (url != '') styleStr = 'background-image: url(\'' + url + '\');';


                                $previewer.addClass('preview-for-loc')
                                    .find('.device-' + type).remove().end()
                                    .append('<div class="device-spec device-' + type + '" style="' + styleStr + '"></div>');

                            }

                            // Let's fill URL into data
                            $(idv_ref).data("url", url);

                        }

                        if (type == 'tablet') {
                            $(o).hover(
                                function(){
                                    $($(this).attr('previewer')).addClass('for-tablet');
                                },
                                function(){
                                    $($(this).attr('previewer')).removeClass('for-tablet');
                                }
                            );
                        }

                    }


                });
            },

            reflectTabName: function () {
                var $li = fn.tabNav.$tabBoards.find("li.active");
                var tabId = $li.attr('data-tab-id');

                if ($li.find("input[name=tab_name]").length > 0) {
                    var tabLabel = $li.find("input[name=tab_name]").val();
                    fn.tabNav.$tabNav.find("li.tab[data-tab-id='" + tabId + "'] .tab-header .tab-label").html(escapeHtml(tabLabel));
                }
            },

            monitor: function () {

                var $tab = fn.tabNav.$tabBoards.children('li.active'),
                    tabId = $tab.attr('data-tab-id'),
                    changed = false;

                $tab.triggerHandler('onUpdateFlyupAgent'); // need to hook up

                var tab_nav_changed = fn.tabNav.isChanged(true);
                var cont_changed = fn.tab.content_changed();

                changed = tab_nav_changed || cont_changed;
                // changed = cont_changed;

                if (changed) {
                    // We should disappear the informative popup.
                    var $infoPubPopup = $('#move-to-publish-step');
                    if ($infoPubPopup.is(':visible')) {
                        $infoPubPopup.hide();
                    }

                    // if now loading, then just ignore the flag, simply disable save button
                    if (fn.tabNav.$tabContent.children('.loading-overlay').length < 1) {
                        fn.tab.$save.removeAttr('disabled');
                    }

                } else {
                    fn.tab.$save.attr('disabled', true);
                }

                return changed;
            },

            activated: function () {
                var $tab = fn.tabNav.$tabBoards.children('li.active'),
                    tabId = $tab.attr('data-tab-id');

                $tab.triggerHandler('activated');
            },

            deActivated: function () {
                var $tab = fn.tabNav.$tabBoards.children('li.active'),
                    tabId = $tab.attr('data-tab-id');

                $tab.triggerHandler('deActivated');
            },

            content_changed: function () {
                var $tab = fn.tabNav.$tabBoards.children('li.active');
                var isChanged =  fn.tab.content_changed_checker($tab);

                return isChanged;
            },

            my_content_changed: function () {
                return fn.tab.content_changed_checker ($(this));
            },

            content_changed_checker: function ($tab) {

                var changed = false;

                $.each($tab.find('[name]'), function (idx, itm) {
                    // Update tab name.
                    /*
                    // Austin commented as this cause tab label mixed up here and there
                    if ($(this).is('[name="tab_name"]')) {
                        fn.tabNav.$tabList.find('li.tab.active .tab-header .tab-title span.tab-label').html($(this).val());
                    }
                    */

                    var is_checking_elem = false;
                    var attr = $(this).attr('data-val');
                    // For some browsers, `attr` is undefined; for others,
                    // `attr` is false.  Check for both.
                    if (typeof attr !== typeof undefined && attr !== false) {
                        is_checking_elem = true;
                    }

                    if (($(this).attr('data-val-skip') != "true") && is_checking_elem) { // those who has data-val-skip="true" will be ignored
                        if ($(this).prop('tagName').toLowerCase() == "input" && ($(this).attr('type').toLowerCase() == "checkbox" || $(this).attr('type').toLowerCase() == "radio")) {
                            var checked = $(this).prop('checked');
                            if (checked != $(this).attr('data-val')) {
                                changed = true;
                            }
                        } else {
                            var elemVal = $(this).val();
                            var attrVal = $(this).attr('data-val');
                            if ($(this).prop('tagName').toLowerCase() == 'textarea') {
                                try {

                                    elemVal = $(this).redactor('code.get');

                                    $fakeDiv = $('<div style="display: none;"></div>').appendTo($('body')).html(attrVal);
                                    attrVal = $fakeDiv.html();
                                    $fakeDiv.remove();

                                    // means, redactor is enabled for this object, then let's remove all line break
                                    elemVal = elemVal.replace(/(\r\n\s+|\n\s+|\r\s+)/gm,"");
                                    attrVal = attrVal.replace(/(\r\n\s+|\n\s+|\r\s+)/gm,"");

                                    elemVal = elemVal.replace(/(\r\n|\n|\r)/gm,"");
                                    attrVal = attrVal.replace(/(\r\n|\n|\r)/gm,"");

                                    // so weired but no way, some how redactor adds space just after <br>, what a ridiculouse editor....
                                    /*
                                    elemVal = elemVal.replace(/<br>\s+/gm,"<br>");
                                    attrVal = attrVal.replace(/<br>\s+/gm,"<br>");
                                    */
                                    elemVal = elemVal.replace(/>\s+/gm,">");
                                    attrVal = attrVal.replace(/>\s+/gm,">");


                                    elemVal = elemVal.replace(/<(br|hr)\/>/gm,"$1");
                                    attrVal = attrVal.replace(/<(br|hr)\/>/gm,"<$1>");

                                    elemVal = elemVal.replace(/<(br|hr)\s+\/>/gm,"$1");
                                    attrVal = attrVal.replace(/<(br|hr)\s+\/>/gm,"<$1>");

                                } catch (e) {}
                                elemVal =  elemVal.trim();
                                attrVal =  attrVal.trim();
                            }

                            if (!compareHtml(elemVal, attrVal)) { // Austin updated
                                changed = true;
                            }
                        }
                    }

                    if (changed) {
                        // Exit loop if anyone was changed
                        return false;
                    }
                });

                var ext_changed = $tab.triggerHandler('monitorBoard', {result: changed});
                if (ext_changed == undefined) ext_changed = false;


                var save_changed = $tab.triggerHandler('monitorBoardForce', {result: (changed || ext_changed)});

                if (save_changed == undefined) {
                    return (changed || ext_changed);
                } else {
                    return save_changed;
                }

            },

            get_content_data: function() {
                var $tab = fn.tabNav.$tabBoards.children('li.active'),
                    tabId = $tab.length ? $tab.attr('data-tab-id') : 0,
                    data = {id: tabId};


                // Grab Tab Content
                $.each($tab.find('[name]'), function (idx, itm) {
                    var name = $(this).attr('name');
                    var type = $(this).attr('type');

                    // radio wrap uses checkbox inside of it to cause wrong action
                    // let's fix it up here
                    if ((type == 'checkbox') && ($(this).parents('.radio_wrapper').length > 0)) {
                        if ($(this).is(':checked')) {
                            data[name] = $(this).val();
                        }
                        type = 'already_set';
                    }

                    switch (type) {
                        case 'checkbox':
                            data[name] = $(this).is(':checked') ? 1 : 0;
                            break;
                        case 'radio':
                            data[name] = $('[name="' + name + '"]:checked').val();
                            break;
                        case 'already_set':
                            break;
                        default:
                            data[name] = $(this).val();
                            break;
                    }

                });

                var ext_data = $tab.triggerHandler('beforeSave', data);
                if (ext_data == undefined) {
                    ext_data = data;
                }

                return ext_data;
            },

            showInfomativeDialog: function() {

                // Add Informative dialog to build page for publish step
                var $move_publish_step = $('#move-to-publish-step'),
                    $info_dialog_dot = $('.dot', $move_publish_step),
                    $info_dialog_content = $('.tutorial-content', $move_publish_step),
                    $sidebar = $('.wrapper > .sidebar'),
                    $subNavContent = $('.sidebar-sub-nav.active', $sidebar),
                    $publishTabElement = $('li:nth-child(3)', $subNavContent),// Publish sub nav tab element.
                    $okayLink = $('a.got_it', $info_dialog_content);

                var refPosition = $publishTabElement.offset();

                $move_publish_step.show();
                if ($('body').hasClass('sb_expanded')) {
                    $info_dialog_content.css({
                        opacity: 1, 
                        left: refPosition.left + 153,
                        top: refPosition.top - 55
                    }).addClass('appear');
                    $info_dialog_dot.css({
                        display: 'block', 
                        left: refPosition.left + 105,
                        top: refPosition.top + 12
                    });
                } else {
                    $info_dialog_content.css({
                        opacity: 1, 
                        left: refPosition.left + 64,
                        top: refPosition.top - 53
                    }).addClass('appear');
                    $info_dialog_dot.css({
                        display: 'block',
                        left: refPosition.left + 17,
                        top: refPosition.top + 16
                    });
                }
                /* add bytes*/
                $okayLink.on('click', function() {
                    $move_publish_step.removeClass('appear').addClass('disappear').hide();
                    $.cookie('show_informative_dialog', 1);
                });

            },

            save: function (opts) {

                var $tab = fn.tabNav.$tabBoards.children('li.active'),
                    tabId = $tab.length ? $tab.attr('data-tab-id') : 0,
                    data = {id: tabId}, tabChanged = fn.tabNav.getChanges();

                // Close all visible horizontal flyups
                fn.flyup.closeOtherFlyups();

                // If custom save action is defined, and it returns true, then should skip legacy save.
                var is_custom_save = $tab.triggerHandler('customSave');
                if (is_custom_save == true) {
                    // We need do search after save, since it can change tab name - Douglas
                    if (fn.tabNav.$search.find('.icon-tab-search').hasClass('active')) {
                        fn.tabNav.search();
                    }
                    return;
                }

                /*
                // Save.
                // Tab change save
                if (tabChanged) {

                    // fn.tabNav.$tabNav.started({opacity: .5});
                    $("body > .wrapper > .content").scrollTop(0); // Loading overlay moves down if scrollTop > 0

                    ajax.post('build.save', {'tabs': tabChanged}, function (json) {

                        // fn.$pageBody.completed();
                        fn.tabNav.$tabNav.completed();

                        if (!json.success) {
                            notify.error(json.msg);
                            return;
                        }

                        // refresh tab nav with new data
                        fn.tabNav.update(json.data.tabs);

                        fn.tab.monitor();
                    });
                }
                */

                // Save
                var ext_data = fn.tab.get_content_data();

                if (tabChanged) {
                    ext_data["tabs"] = tabChanged;
                }

                // Content change save
                if (fn.tab.content_changed() || tabChanged) {

                    // fn.tabNav.$tabContent.overlay({opacity: .5, 'z-index': 100});
                    fn.tabNav.$tabContent.overlay({'opacity': .5, 'background-color': '#f8f8f8', 'z-index': 100});
                    fn.tab.$save.attr('disabled', true);

                    // fn.tabNav.$tabContent.started({opacity: .5});

                    // if no tab detail page is loaded, then should send emptyrequest.
                    var req_sub_url = 'emptyrequest';
                    try {
                        req_sub_url = fn.core.data.tabs[tabId].baseRoute;
                    } catch(e) {}

                    var post_url = $tab.triggerHandler('setSaveURL');
                    if (post_url == undefined) {
                        post_url = 'tab.' + req_sub_url + '.save';
                    }

                    ajax.post(post_url, ext_data, function (json) {

                        fn.tabNav.$tabContent.completed();
                        fn.tab.$save.removeAttr('disabled');
                        // fn.tabNav.$tabContent.completed();

                        if (!json.success) {
                            notify.error(json.msg);
                            return;
                        }

                        // Added By Meng
                        window.app_previewer.refresh();

                        // Update tab navigation.
                        if (json.data && json.data.tabs) {
                            fn.tabNav.update(json.data.tabs);
                        }

                        notify.success(json.msg);

                        // Increase the save button click count for each tab save.

                        if ($.inArray( tabId, fn.tab.tabIdList ) < 0 && fn.tab.tabIdStore != tabId) {
                            fn.tab.tabIdList.push(tabId);
                        }

                        fn.tab.tabIdStore = tabId;
                        
                        // Set changed tab count to cookie.
                        $.cookie('changed_tab_count', fn.tab.tabIdList.length);

                        if (!$.cookie('show_informative_dialog') && ($.cookie('changed_tab_count') > 4)) {
                            setTimeout(function() {
                                fn.tab.showInfomativeDialog();
                            }, 2000);
                        }

                        fn.setTabField(tabId, "changed", {});

                        if (!tabId) {

                            // Austin add this here...
                            fn.tab.monitor();

                            return;
                        }

                        fn.tabNav.$tabList.children('li[data-tab-id="' + json.id + '"]').find('.tab-header .tab-title .tab-name').html(escapeHtml(json.tab_name));
                        $tab.find('input#tab_name').attr({'data-val': escapeHtml(json.tab_name)});
                        $tab.trigger('updateContent', json);

                        /* Added by douglas */
                        if (fn.tab.event && fn.tab.opts && fn.tab.opts.onSubmit) {
                            fn.tab.opts.onSubmit(fn.tab.event, fn.tab.opts);
                            fn.tab.event = null;
                            fn.tab.opts = null;
                        }
                        else {
                            fn.tab.reflectTabName();

                            // Austin add this here...
                            fn.tab.monitor();
                        }

                        // After save we need do search again, since the save can change tab name - Douglas
                        if (fn.tabNav.$search.find('.icon-tab-search').hasClass('active')) {
                            fn.tabNav.search();
                        }
                    });
                }

                /*
                fn.$pageBody.started({opacity: .5});
                ajax.post(tabId ? 'tab.' + fn.core.data.tabs[tabId].baseRoute + '.save' : 'build.save', ext_data, function (json) {
                    console.log(json);
                    fn.$pageBody.completed();
                    if (!json.success) {
                        notify.error(json.msg);
                        return;
                    }

                    // Update tab navigation.
                    if (json.data && json.data.tabs) {
                        fn.tabNav.update(json.data.tabs);
                    }

                    notify.success(json.msg);
                    if (!tabId) {
                        return;
                    }
                    fn.tabNav.$tabList.find('> li[data-tab-id="' + json.id + '"] .tab-header .tab-title .tab-name').html(json.tab_name);
                    $tab.find('input#tab_name').attr({'data-val': json.tab_name});
                    $tab.trigger('updateContent', json);
                    // Austin add this here...
                    fn.tab.monitor();
                });
                */
            },
            /**
             * Function for force saving data, triggered by forceSave
             * @author Piotr Bozetka
             * @ticket DEV-56
             * @param opts
             */
            // DEV-56
            // Piotr Bozetka
            // function for force saving data
            forceSave: function (opts) {
                console.log('force save');
                var $tab = fn.tabNav.$tabBoards.children('li.active'),
                    tabId = $tab.length ? $tab.attr('data-tab-id') : 0,
                    data = {id: tabId}, tabChanged = fn.tabNav.getChanges();


                // if no tab detail page is loaded, then should send emptyrequest.
                var req_sub_url = 'emptyrequest';
                try {
                    req_sub_url = fn.core.data.tabs[tabId].baseRoute;
                } catch(e) {}

                var post_url = $tab.triggerHandler('setSaveURL');
                if (post_url == undefined) {
                    post_url = 'tab.' + req_sub_url + '.save';
                }

                // Save
                var ext_data = fn.tab.get_content_data();

                if (tabChanged) {
                    ext_data["tabs"] = tabChanged;
                }

                ajax.post(post_url, ext_data, function (json) {

                    // fn.tabNav.$tabContent.completed();
                    // fn.tab.$save.removeAttr('disabled');
                    // fn.tabNav.$tabContent.completed();

                    // if (!json.success) {
                    //     notify.error(json.msg);
                    //     return;
                    // }

                    // Added By Meng
                    // window.app_previewer.refresh();

                    // Update tab navigation.
                    // if (json.data && json.data.tabs) {
                    //     fn.tabNav.update(json.data.tabs);
                    // }

                    // notify.success(json.msg);

                    // Increase the save button click count for each tab save.

                    // if ($.inArray( tabId, fn.tab.tabIdList ) < 0 && fn.tab.tabIdStore != tabId) {
                    //     fn.tab.tabIdList.push(tabId);
                    // }

                    // fn.tab.tabIdStore = tabId;

                    // Set changed tab count to cookie.
                    // $.cookie('changed_tab_count', fn.tab.tabIdList.length);

                    // fn.setTabField(tabId, "changed", {});

                    // if (!tabId) {

                        // Austin add this here...
                        // fn.tab.monitor();

                        // return;
                    // }

                    // fn.tabNav.$tabList.children('li[data-tab-id="' + json.id + '"]').find('.tab-header .tab-title .tab-name').html(escapeHtml(json.tab_name));
                    // $tab.find('input#tab_name').attr({'data-val': escapeHtml(json.tab_name)});
                    // $tab.trigger('updateContent', json);

                    /* Added by douglas */
                    // if (fn.tab.event && fn.tab.opts && fn.tab.opts.onSubmit) {
                    //     fn.tab.opts.onSubmit(fn.tab.event, fn.tab.opts);
                    //     fn.tab.event = null;
                    //     fn.tab.opts = null;
                    // }
                    // else {
                        // fn.tab.reflectTabName();

                        // Austin add this here...
                        // fn.tab.monitor();
                    // }
                });
            },

            save_tab_meta: function () {

                var tabChanged = fn.tabNav.getChanges(true);
                var ext_data = {};

                if (tabChanged) {
                    ext_data["tabs"] = tabChanged;
                } else {
                    return false;
                }

                post_url = 'tab.emptyrequest.save';
                // fn.tab.$save.removeAttr('disabled');

                ajax.post(post_url, ext_data, function (json) {

                    // Update tab navigation.
                    if (json.data && json.data.tabs) {
                        fn.tabNav.update(json.data.tabs);

                        if (json.data.tabs.removed.length > 0) {
                            if (fn.tabNav.$tabNav.find('li.tab').not('[data-tab-id=0]').length > 0) {
                                notify.success($phrases.build_desc_tab_delete_success);
                            } else {
                                notify.success($phrases.build_desc_tab_delete_all_success);

                                setTimeout(function() {
                                    window.location.reload();
                                }, 2000);
                            }
                        } else if ((json.data.tabs.activated && (json.data.tabs.activated.length > 0)) || (json.data.tabs.deactivated && (json.data.tabs.deactivated.length > 0))) {
                            notify.success($phrases.build_desc_tab_save_state_success);
                        } else if (typeof json.data.tabs.seq == 'object') {
                            notify.success($phrases.build_desc_tab_save_seq_success);
                        }
                    }

                    fn.tabNav.monitor();
                });

                return true;
            }

        },

        infoHelper: {

            $wrapper: null,
            $note: null,
            $laptop: null,
            $screen: null,

            $obj_h2: null,
            $obj_label: null,
            $obj_board: null,

            anim_set: null,
            anim_ind: null,

            anim_dot_set: null,
            anim_dot_ind:null,


            res_imgs: [],
            res_img_loaded: null,
            img_src: [],

            hover_ready: false,


            init: function() {

                fn.infoHelper.$wrapper = $('.page-build-info-help');
                fn.infoHelper.$note = fn.infoHelper.$wrapper.find('.note-block');
                fn.infoHelper.$laptop = fn.infoHelper.$wrapper.find('.laptop');
                fn.infoHelper.$screen = fn.infoHelper.$laptop.find('.laptop-screen');

                fn.infoHelper.$obj_h2 = fn.infoHelper.$note.find('h2');
                fn.infoHelper.$obj_label = fn.infoHelper.$note.find('label');
                fn.infoHelper.$obj_board = fn.infoHelper.$screen.find('.objboard');

                fn.infoHelper.hover_ready = false;

                // Live Chat Init
                window.app_previewer.contact_menu.init();

                fn.infoHelper.$laptop.on('widthChanged',function(){
                    var widthv = $(this).width();
                    $(this).removeClass('size-small size-large size-xs-1');
                    if (widthv < 565) {
                        $(this).addClass('size-xs-1');
                    } else if (widthv < 1065) {
                        $(this).addClass('size-small');
                    } else {
                        $(this).addClass('size-large');
                    }

                    $(this).removeClass('size-small-1');
                    if (widthv < 660) {
                        $(this).addClass('size-small-1');
                    }

                });
                fn.infoHelper.$laptop.trigger('widthChanged');


                fn.infoHelper.res_img_loaded = 0;
                fn.infoHelper.img_src = [
                    asset + '/images/pages/base/edit/build/info-help/laptop.png?v=' + version,
                    asset + '/images/pages/base/edit/build/info-help/blue-dot.png',
                    asset + '/images/pages/base/edit/build/info-help/zoomer-0.png',
                    asset + '/images/pages/base/edit/build/info-help/zoomer-1.png',
                    asset + '/images/pages/base/edit/build/info-help/zoomer-2.png',
                    asset + '/images/pages/base/edit/build/info-help/zoomer-3.png',
                    asset + '/images/pages/base/edit/build/info-help/zoomer-4.png',
                    asset + '/images/pages/base/edit/build/info-help/zoomer-5.png'
                ];
                for (var i=0; i<fn.infoHelper.img_src.length; i++) {
                    fn.infoHelper.res_imgs[i] = new Image();
                    fn.infoHelper.res_imgs[i].onload = function(){
                        fn.infoHelper.res_img_loaded = fn.infoHelper.res_img_loaded + 1;
                        fn.infoHelper.checkAllImgLoaded();
                    };
                    fn.infoHelper.res_imgs[i].src = fn.infoHelper.img_src[i];
                }

                fn.infoHelper.anim_set = [
                    [fn.infoHelper.$obj_h2, 'fadeIn'],
                    [fn.infoHelper.$obj_label, 'fadeIn'],
                    [fn.infoHelper.$obj_board, 'fadeIn']
                ];

                var effects = ['fadeInLeft','fadeInRight', 'fadeInUp','fadeInDown', 'zoomInLeft', 'zoomInRight', 'bounceInLeft', 'bounceInRight', 'bounceInUp', 'bounceInDown'];

                fn.infoHelper.anim_dot_set = [
                    /*
                    [fn.infoHelper.$obj_board.find('.dot-set-0'), effects[Math.floor(Math.random() * effects.length)]],
                    [fn.infoHelper.$obj_board.find('.dot-set-1'), effects[Math.floor(Math.random() * effects.length)]],
                    [fn.infoHelper.$obj_board.find('.dot-set-2'), effects[Math.floor(Math.random() * effects.length)]],
                    [fn.infoHelper.$obj_board.find('.dot-set-3'), effects[Math.floor(Math.random() * effects.length)]],
                    [fn.infoHelper.$obj_board.find('.dot-set-4'), effects[Math.floor(Math.random() * effects.length)]],
                    [fn.infoHelper.$obj_board.find('.dot-set-5'), effects[Math.floor(Math.random() * effects.length)]]
                    */

                    [fn.infoHelper.$obj_board.find('.dot-set-0'), 'fadeInUp'],
                    [fn.infoHelper.$obj_board.find('.dot-set-4'), 'fadeInUp'],
                    [fn.infoHelper.$obj_board.find('.dot-set-5'), 'fadeInUp'],
                    [fn.infoHelper.$obj_board.find('.dot-set-1'), 'fadeInLeft'],
                    [fn.infoHelper.$obj_board.find('.dot-set-2'), 'fadeInRight'],
                    [fn.infoHelper.$obj_board.find('.dot-set-3'), 'fadeInLeft']
                ];

                fn.infoHelper.anim_ind = 0;
                fn.infoHelper.anim_dot_ind = 0;

                /*
                fn.infoHelper.$screen.anythingZoomer({
                    switchEvent : 'showFulLSizedImage', // to disable double click as this default value is dblclick
                    edge: 0
                });
                */

                $('.blue-dot-delegate', fn.infoHelper.$obj_board).hover(
                    function(e) {

                        // fn.infoHelper.$screen.anythingZoomer('disable');
                        if (!fn.infoHelper.hover_ready) {
                            return;
                        }

                        $('body > .wrapper > .content').overlay({
                            'background': '#dddddd',
                            'z-index': 100,
                            'position': 'fixed',
                            'opacity': 0.8
                        }/*, {
                            'from': {'opacity': 0},
                            'to': {'opacity': 0.8}
                        }*/);
                        $('.dot-set-' + $(this).attr('ref'), fn.infoHelper.$obj_board).addClass('active');
                    },
                    function(e) {

                        // fn.infoHelper.$screen.anythingZoomer('enable');

                        $('.dot-set-' + $(this).attr('ref'), fn.infoHelper.$obj_board).removeClass('active');
                        $('body > .wrapper > .content').completed({
                            'from': {'opacity': 0.8},
                            'to': {'opacity': 0},
                            'duration': 200
                        });
                    }
                );

                // fn.infoHelper.init_css();
                // fn.infoHelper.animate();

            },

            checkAllImgLoaded: function() {
                if (fn.infoHelper.res_img_loaded >= fn.infoHelper.img_src.length) {
                    // All images are loaded ... so lets go
                    fn.core.setupOverlay(false);
                    fn.infoHelper.animate();
                }
            },

            init_css: function() {


                return;


                fn.infoHelper.$obj_h2.css({
                    'position': 'absolute',
                    'visibility': 'visible',
                    'top': '-500px',
                    'opacity': 0,
                    'width': '80%'
                });

                fn.infoHelper.$obj_label.css({
                    'position': 'absolute',
                    'visibility': 'visible',
                    'left': '-500px',
                    'opacity': 0,
                    'top': fn.infoHelper.$obj_h2.height() + 60,
                    'width': '80%'
                });

                fn.infoHelper.$obj_board.css({
                    'position': 'absolute',
                    'visibility': 'visible',
                    'top': '-2500px',
                    'opacity': 0,
                    'width': '80%'
                });


                return;





                fn.infoHelper.$obj_h2.css({'margin-top': -200, 'opacity': 0, 'visibility': 'visible'});
                fn.infoHelper.$obj_label.css({'margin-left': -500, 'opacity': 0, 'visibility': 'visible'});
                fn.infoHelper.$obj_board.css({'margin-right': -300, 'opacity': 0, 'visibility': 'visible'});
            },


            do_animate: function($obj, x, callback) {
                $obj.removeClass($obj.attr('anim_class')).attr({'anim_class': x + ' animated'}).addClass(x + ' animated').one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function(){
                  $(this).removeClass($(this).attr('anim_class'));
                  if (callback) callback
                });
            },

            run_animate: function(ind) {
                if (ind < fn.infoHelper.anim_set.length) {

                    var prev_class = fn.infoHelper.anim_set[ind][0].attr('anim_class') + ' animated';
                    fn.infoHelper.anim_set[ind][0].removeClass(prev_class).attr({'anim_class': fn.infoHelper.anim_set[ind][1]}).addClass(fn.infoHelper.anim_set[ind][1] + ' animated').one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function(){

                      var prev_class = $(this).attr('anim_class') + ' animated';
                      $(this).removeClass(prev_class);

                      fn.infoHelper.anim_ind = fn.infoHelper.anim_ind + 1;
                      fn.infoHelper.run_animate(fn.infoHelper.anim_ind);

                    });

                    fn.infoHelper.anim_set[ind][0].css({'visibility': 'visible'});
                } else {
                    // main object is all up there, lets animate blue dots

                    fn.infoHelper.anim_dot_ind = 0;
                    fn.infoHelper.run_dot_animate();

                }
            },

            run_dot_animate: function() {

                // $('.dot-set').css({'visibility': 'visible'}).fadeIn();

                for (var i=0; i<fn.infoHelper.anim_dot_set.length; i++ ) {


                    setTimeout(function(){

                        var ind = fn.infoHelper.anim_dot_ind;

                        fn.infoHelper.anim_dot_ind = ind + 1;
                        if (ind >=  fn.infoHelper.anim_dot_set.length) return;
                        if (fn.infoHelper.anim_dot_set[ind][0].hasClass('animated')) return;

                        var prev_class = fn.infoHelper.anim_dot_set[ind][0].attr('anim_class') + ' animated';
                        fn.infoHelper.anim_dot_set[ind][0].removeClass(prev_class).attr({'anim_class': fn.infoHelper.anim_dot_set[ind][1]}).addClass(fn.infoHelper.anim_dot_set[ind][1] + ' animated').one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function(){

                          var prev_class = $(this).attr('anim_class') + ' animated';
                          $(this).removeClass(prev_class);
                        });

                        fn.infoHelper.anim_dot_set[ind][0].css({'visibility': 'visible'});

                    }, i * 300);
                }



                /*
                if (ind < fn.infoHelper.anim_dot_set.length) {

                    var prev_class = fn.infoHelper.anim_dot_set[ind][0].attr('anim_class') + ' animated';
                    fn.infoHelper.anim_dot_set[ind][0].removeClass(prev_class).attr({'anim_class': fn.infoHelper.anim_dot_set[ind][1]}).addClass(fn.infoHelper.anim_dot_set[ind][1] + ' animated').one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function(){

                      var prev_class = $(this).attr('anim_class') + ' animated';
                      $(this).removeClass(prev_class);

                      fn.infoHelper.anim_dot_ind = fn.infoHelper.anim_dot_ind + 1;
                      fn.infoHelper.run_dot_animate(fn.infoHelper.anim_dot_ind);

                    });

                    fn.infoHelper.anim_dot_set[ind][0].css({'visibility': 'visible'});

                } else {

                }
                */

            },


            animate: function() {

                fn.infoHelper.anim_ind = 0;

                for (var i=0; i<fn.infoHelper.anim_set.length; i++ ) {


                    setTimeout(function(){

                        var ind = fn.infoHelper.anim_ind;

                        fn.infoHelper.anim_ind = ind + 1;
                        if (ind >=  fn.infoHelper.anim_set.length) return;
                        if (fn.infoHelper.anim_set[ind][0].hasClass('animated')) return;

                        var prev_class = fn.infoHelper.anim_set[ind][0].attr('anim_class') + ' animated';
                        fn.infoHelper.anim_set[ind][0].removeClass(prev_class).attr({'anim_class': fn.infoHelper.anim_set[ind][1]}).addClass(fn.infoHelper.anim_set[ind][1] + ' animated').one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function(){

                          var prev_class = $(this).attr('anim_class') + ' animated';
                          $(this).removeClass(prev_class);
                        });

                        fn.infoHelper.anim_set[ind][0].css({'visibility': 'visible'});

                    }, i * 1000);
                }

                setTimeout(function(){
                    fn.infoHelper.anim_dot_ind = 0;
                    fn.infoHelper.run_dot_animate();
                }, fn.infoHelper.anim_set.length * 1000 + 500);

                setTimeout(function(){
                    fn.infoHelper.hover_ready = true;
                }, fn.infoHelper.anim_set.length * 1000 + fn.infoHelper.anim_dot_set.length * 300 + 500);


                return;
                setTimeout(function(){
                    fn.infoHelper.run_animate(0);
                }, 1000);

                return;

                setTimeout(function(){
                    fn.infoHelper.do_animate(fn.infoHelper.$obj_h2, 'bounceInDown');
                    fn.infoHelper.$obj_h2.css({'visibility': 'visible'});
                }, 1000);

                setTimeout(function(){
                    fn.infoHelper.do_animate(fn.infoHelper.$obj_label, 'bounceInLeft');
                    fn.infoHelper.$obj_label.css({'visibility': 'visible'});
                }, 2000);

                setTimeout(function(){
                    fn.infoHelper.do_animate(fn.infoHelper.$obj_board, 'flipInX');
                    fn.infoHelper.$obj_board.css({'visibility': 'visible'});
                }, 2500);


                return;
                setTimeout(function(){
                    fn.infoHelper.$obj_h2.animate({
                        'top': 0,
                        'opacity': 1
                    }, 1000);
                }, 1500);

                setTimeout(function(){
                    fn.infoHelper.$obj_label.animate({
                        'left': '10%',
                        'opacity': 1
                    }, 1000);
                }, 3000);

                setTimeout(function(){
                    fn.infoHelper.$obj_board.animate({
                        'opacity': 1,
                        'top': fn.infoHelper.$obj_h2.height() + fn.infoHelper.$obj_label.height() + 60,
                    }, 1000);
                }, 4000);



                return;

                var options = {
                    animateThreshold: 100,
                    scrollPollInterval: 20
                };

                setTimeout(function(){
                    fn.infoHelper.$obj_h2.AniView(options);
                }, 1000);


                fn.infoHelper.$obj_board.parent().turnBox({
                    width: 710,
                    height: 410,
                    axis: "X",
                    even: 410,
                    perspective: 800,
                    duration: 200,
                    delay: 0,
                    easing: "linear", // "ease-in-out"
                    direction: "positive",
                    type: "real"
                });

                setTimeout(function(){
                    fn.infoHelper.$obj_board.parent().turnBoxAnimate({
                      face: 2
                    });
                }, 2000);

                return;

                fn.infoHelper.$obj_h2.animate({
                    'opacity': 1,
                    'margin-top': 0
                }, 1000);

                fn.infoHelper.$obj_label.animate({
                    'opacity': 1,
                    'margin-left': 0
                }, 2000);

                fn.infoHelper.$obj_board.animate({
                    'opacity': 1,
                    'margin-right': 0
                }, 3000);
            }
        },

        helpInfo: {
            $onboarding_tutorial_wrapper: null,
            $tutorial_tips_wrapper: null,
            $tip_add_features: null,
            $tip_adjust_icon: null,
            $tip_inactive_features: null,
            $tip_save_changes: null,
            $tip_preview_changes: null,

            $dot_add_features: null,
            $dot_adjust_icon: null,
            $dot_inactive_features: null,
            $dot_save_changes: null,
            $dot_preview_changes: null,

            /* Elements for Dropdown Menu */
            $onboarding_build_btn: null,
            $onboarding_design_btn: null,
            /* Elements for Onboarding Tutorial */
            $take_tour_btn: null,
            $next_tip_btn: null,
            $prev_tip_btn: null,
            $exit_tip_btn: null,
            /* Array for Step Names */
            step_names: [
                            'Add features',
                            'Adjust your feature icon',
                            'Inactive features',
                            'Save your changes',
                            'Preview your changes'
                        ],
            /* Actions */
            init: function() {
                fn.helpInfo.$onboarding_tutorial_wrapper = $("#onboarding_tutorial_wrapper");
                fn.helpInfo.$tutorial_tips_wrapper = fn.helpInfo.$onboarding_tutorial_wrapper.find(".build-tips-wrapper");

                fn.helpInfo.$tip_add_features = fn.helpInfo.$tutorial_tips_wrapper.find(".tip-add-features");
                fn.helpInfo.$tip_adjust_icon = fn.helpInfo.$tutorial_tips_wrapper.find(".tip-adjust-icon");
                fn.helpInfo.$tip_inactive_features = fn.helpInfo.$tutorial_tips_wrapper.find(".tip-inactive-features");
                fn.helpInfo.$tip_save_changes = fn.helpInfo.$tutorial_tips_wrapper.find(".tip-save-changes");
                fn.helpInfo.$tip_preview_changes = fn.helpInfo.$tutorial_tips_wrapper.find(".tip-preview-changes");

                fn.helpInfo.$dot_add_features = fn.helpInfo.$tutorial_tips_wrapper.find(".dot-add-features");
                fn.helpInfo.$dot_adjust_icon = fn.helpInfo.$tutorial_tips_wrapper.find(".dot-adjust-icon");
                fn.helpInfo.$dot_inactive_features = fn.helpInfo.$tutorial_tips_wrapper.find(".dot-inactive-features");
                fn.helpInfo.$dot_save_changes = fn.helpInfo.$tutorial_tips_wrapper.find(".dot-save-changes");
                fn.helpInfo.$dot_preview_changes = fn.helpInfo.$tutorial_tips_wrapper.find(".dot-preview-changes");                

                $('.sidebar .sidebar-footer .sidebar-toggler').click(fn.helpInfo.adjustTipPosition);
                $(window).on('resize', fn.helpInfo.adjustTipPosition);


                fn.helpInfo.$onboarding_build_btn = fn.$pageHeader.find('.build-help-info .help-info-dropdown .dropdown-menu li a.help-info-onboarding');
                fn.helpInfo.$onboarding_design_btn = fn.$pageHeader.find('.design-help-info .help-info-dropdown .dropdown-menu li a.help-info-onboarding');
                            
                fn.helpInfo.initModals();

                fn.helpInfo.$take_tour_btn = $('#modal_build_tutorial').find(".btn-take-tour");
                fn.helpInfo.$take_tour_btn.on('click', function() {
                    fn.helpInfo.scrollTab();
                    fn.helpInfo.adjustTipPosition();
                    window.setTimeout(function() {
                        fn.helpInfo.$tutorial_tips_wrapper.css("display", "block");
                        fn.helpInfo.$tutorial_tips_wrapper.find(".tutorial-tip[ref-id=1]").addClass('appear');
                    }, 500);
                    fn.helpInfo.GATrack(fn.helpInfo.step_names[0]);
                });


                /* Tip Actions */
                fn.helpInfo.$next_tip_btn = fn.helpInfo.$tutorial_tips_wrapper.find(".btn-next");
                fn.helpInfo.$prev_tip_btn = fn.helpInfo.$tutorial_tips_wrapper.find(".btn-prev");
                fn.helpInfo.$exit_tip_btn = fn.helpInfo.$tutorial_tips_wrapper.find(".btn-exit");  

                fn.helpInfo.initTipActions();
                fn.helpInfo.checkOnboardingAvailable();
            },

            initModals: function() {
                /* Bind modal for Build Onboarding Tutorial */
                $("#modal_build_tutorial .modal-header .img-sub-container").slideUp();
                fn.helpInfo.$onboarding_build_btn.on('click', function() {
                    ajax.post('build.store_app_meta_tutorial', {}, function(json) {
                        
                    });
                });
                fn.helpInfo.$onboarding_build_btn.bind_modal({
                    modalId: 'modal_build_tutorial',
                    before: function(e) {
                        if (fn.helpInfo.$onboarding_build_btn.hasClass('disabled')) {
                            e.preventDefault();
                            e.stopPropagation();
                            return false;
                        }
                        return true;
                    },
                    onShown: function() {
                        $("#modal_build_tutorial .modal-header .img-sub-container").slideDown();
                        fn.helpInfo.GATrack('Landing Modal');
                    },
                    onHide: function() {
                        $("#modal_build_tutorial .modal-header .img-sub-container").slideUp();
                        first_visit = 0; //debug for staging
                    }
                });   
            },
            scrollTab: function() {
                var currentScrollTop = $(".content .page-body .tab-list").scrollTop();
                var sectionTop = $(".content .page-body .tab-list").offset().top;
                var offsetHeight =  $("#hellobar-wrapper").outerHeight() + 
                                    $("#cms_header").outerHeight() + 
                                    $(".page-header").outerHeight() + 
                                    $(".content .page-body .tab-nav .row-xs").outerHeight() + 10;
                if($(".tab.active").length > 0) {
                    sectionTop = $(".tab.active").offset().top;
                }
                else {
                    sectionTop = $(".content .page-body .tab-list .tab").offset().top;
                }
                
                var y = currentScrollTop + sectionTop - offsetHeight;
                $('.content .page-body .tab-list').animate({
                    scrollTop: y + "px"
                }, {
                    duration: 100, 
                    complete: function() {
                        fn.helpInfo.adjustTipPosition();
                    }
                });
            },
            checkOnboardingAvailable: function() {
                if($(".content .page-body .tab-list .tab.tab-active").length == 0) {
                    fn.helpInfo.$onboarding_build_btn.addClass('disabled');
                } else {
                    fn.helpInfo.$onboarding_build_btn.removeClass('disabled');
                }
            },

            initTipActions: function() {
                fn.helpInfo.$exit_tip_btn.on('click', function() {
                    fn.helpInfo.$tutorial_tips_wrapper.css("display", "none");
                    fn.helpInfo.$tutorial_tips_wrapper.find(".tutorial-tip").removeClass('appear disappear');
                });

                fn.helpInfo.$next_tip_btn.on('click', function() {
                    var curInd = parseInt($(this).closest(".tutorial-tip").attr("ref-id"));
                    var nextInd = curInd + 1;

                    fn.helpInfo.$tutorial_tips_wrapper.find(".tutorial-tip[ref-id=" + curInd + "]").removeClass('appear disappear');
                    fn.helpInfo.$tutorial_tips_wrapper.find(".tutorial-tip[ref-id=" + curInd + "]").addClass('disappear');
                    fn.helpInfo.$tutorial_tips_wrapper.find(".tutorial-tip[ref-id=" + nextInd + "]").removeClass('appear disappear');
                    fn.helpInfo.$tutorial_tips_wrapper.find(".tutorial-tip[ref-id=" + nextInd + "]").addClass('appear');

                    fn.helpInfo.GATrack(fn.helpInfo.step_names[nextInd-1]);
                });

                fn.helpInfo.$prev_tip_btn.on('click', function() {
                    var curInd = parseInt($(this).closest(".tutorial-tip").attr("ref-id"));
                    var prevInd = curInd - 1;
                    fn.helpInfo.$tutorial_tips_wrapper.find(".tutorial-tip[ref-id=" + curInd + "]").removeClass('appear disappear');
                    fn.helpInfo.$tutorial_tips_wrapper.find(".tutorial-tip[ref-id=" + curInd + "]").addClass('disappear');
                    fn.helpInfo.$tutorial_tips_wrapper.find(".tutorial-tip[ref-id=" + prevInd + "]").removeClass('appear disappear');
                    fn.helpInfo.$tutorial_tips_wrapper.find(".tutorial-tip[ref-id=" + prevInd + "]").addClass('appear');

                    fn.helpInfo.GATrack(fn.helpInfo.step_names[prevInd-1]);
                });
            },

            adjustTipPosition: function() {
                if ($('body').attr('data-page-id') != 'build') {
                    return;
                }
                
                if (!$('.content .page-body .block-content.feature .tab-nav .search-box').hasClass('hide')) {
                    $('.content .page-body .block-content.feature .tab-nav .search-box-close').trigger('click');
                }
                
                var pos = $(".content .page-body .block-content.feature .tab-nav .btn-add-new-tab").first().offset();

                if (typeof pos != 'undefined') {
                    fn.helpInfo.$tip_add_features.css("left", pos.left + 135);
                    fn.helpInfo.$tip_add_features.css("top", pos.top - 65);

                    fn.helpInfo.$dot_add_features.css("left", pos.left + 85);
                    fn.helpInfo.$dot_add_features.css("top", pos.top + 4);
                }

                $tabActive = $(".content .page-body .tab-list .tab.tab-active");

                if ($tabActive.length > 0) {
                    if ($tabActive.filter(".active").length > 0) {
                        pos = $tabActive.filter(".active").offset();
                    } else {
                        pos = $tabActive.offset();
                    }
                
                    fn.helpInfo.$tip_adjust_icon.css("left", pos.left + 115);
                    fn.helpInfo.$tip_adjust_icon.css("top", pos.top - 55);

                    fn.helpInfo.$dot_adjust_icon.css("left", pos.left + 65);
                    fn.helpInfo.$dot_adjust_icon.css("top", pos.top + 15);
                }

                pos = $(".content .page-body .block-content.feature .inactive-tab-list-wrap").offset();
                if (typeof pos != 'undefined') {
                    fn.helpInfo.$tip_inactive_features.css("left", pos.left + 1);// Adjust left for inactive feature arrow.
                    fn.helpInfo.$tip_inactive_features.css("top", pos.top - 175);

                    fn.helpInfo.$dot_inactive_features.css("left", pos.left + 185);
                    fn.helpInfo.$dot_inactive_features.css("top", pos.top + 10);
                }

                pos = $(".page-header .btn-save").offset();
                fn.helpInfo.$tip_save_changes.css("left", pos.left - 370);
                fn.helpInfo.$tip_save_changes.css("top", pos.top - 65);

                fn.helpInfo.$dot_save_changes.css("left", pos.left + 40);
                fn.helpInfo.$dot_save_changes.css("top", pos.top + 4);

                pos = $(".previewer").offset();
                if (typeof pos != 'undefined') {
                    fn.helpInfo.$tip_preview_changes.css("left", pos.left - 400);
                    fn.helpInfo.$tip_preview_changes.css("top", pos.top + 65);

                    fn.helpInfo.$dot_preview_changes.css("left", pos.left + 21);
                    fn.helpInfo.$dot_preview_changes.css("top", pos.top + 136);
                }
            },

            /* Google Analytics*/
            GATrack: function(ga_step_name) {
                if (typeof ga == 'undefined') {
                    return;
                }

                ga('set', '&uid', $.cookie('GA_UserId'));
                ga('newTracker.set', '&uid', $.cookie('GA_UserId'));
                ga('send', 'event', 'Walkthrough Tutorial', 'Build', ga_step_name, {nonInteraction: true});
                ga('newTracker.send', 'event', 'Walkthrough Tutorial', 'Build', ga_step_name, {nonInteraction: true});
            },
        },

        core: {
            data: {
                newTabId: 0,
                tabs: {},
                viewControllers: {},
                icons: {},
                tabOpts: {}
            },

            initVariables: function() {
                fn.$pageBody = $('.page-body');
                fn.$pageHeader = $('.page-header');
                fn.$buildWizardBlock = $('.page-build-wizard-block');
                fn.$buildTabBlock = $('.page-build-tab-block');
                fn.$buildTabBlockContent = fn.$buildTabBlock.find('.block-content.feature');
            },

            initRangeSlider: function() {
                // Rangesliders
                plugin.init_rangeslider({
                    object: $(".flyup .range-slider")
                });
            },

            initSelectbox: function() {
                // Select2
                plugin.init_selectbox({
                    selector: ".select2"
                });
            },

            intiFlyupTogglebox: function()
            {
                $('.flyup .togglebox').togglebox();
            },

            onTooltipWidthChanged: function() {
                // Tooltip hiding...
                $('#page-build .tooltip-box').on('widthChanged',function(){
                    if ($(this).is(':truncated')) {
                        // $(this).css({'visibility':'hidden'});
                        $(this).stop().animate({opacity: 0}, 500);
                    } else {
                        // $(this).css({'visibility':'visible'});
                        $(this).stop().animate({opacity: 1}, 1000); // animate for opacity
                    }
                });
            },

            setupOverlay: function(is_setup) {

                // in layout tpl, overlay itself added as raw html already for build page, so lets remove it first
                // If visits the build page from other pages,we have to skip the loading overlay.
                if ($('body').attr('id') == 'page-build' && $('body').attr('data-page-id') == 'build')
                    $('body > .wrapper > .content').completed();

                if (is_setup) {
                    $('body > .wrapper > .content').css({'overflow': 'hidden'});
                    $('body > .wrapper > .content').overlay({
                        'opacity': 1,
                        'position': 'absolute',
                        'top': 0,
                        'bottom': 0,
                        'left': 0,
                        'right': 0
                    });

                } else {
                    $('body > .wrapper > .content').css({'overflow': 'auto'});
                }
            },

            init: function () {
                this.initVariables();
                this.setupOverlay(false); // Since server is fast enought, let's ignore this.
                this.initRangeSlider();
                this.initSelectbox();
                this.intiFlyupTogglebox();
                this.onTooltipWidthChanged();
                fn.helpInfo.init();
                if(first_visit) {
                    fn.$pageHeader.find('.help-info-dropdown .dropdown-menu li a.help-info-onboarding').css("display", "none");
                }
                Dropzone.autoDiscover = false;
                if (fn.$buildWizardBlock.length) { // Tab build wizard
                    this.setupOverlay(false);
                    fn.wizard.init();
                    fn.helpInfo.$onboarding_build_btn.trigger('click');
                } else { // Tab edition
                    this._load();
                }
            },

            _load: function () {
                $(window).addOverlayWraps(['.tab-nav', '.tab-content']);

                ajax.post('build.load', {}, function (json) {

                    // fn.core.setupOverlay(false);
                    // Prepare and protect data.
                    fn.core._prepare(json);
                    fn.core._protect();

                    // Init each sections.
                    fn.tabNav.init();
                    fn.tab.init();
                    fn.tabIcon.init();

                    // fn.tabNav.procInactiveTabList(true); // lets make disable panel init

                    fn.tabNav.loadLastEdit();
                    
                    fn.infoHelper.init();

                    fn.flyup.init();
                    
                });
            },

            _prepare: function (json) {
                // Set tab data.
                if (json.tabs) {
                    var tabData;
                    $.map(json.tabs, function (tab) {
                        tabData = {
                            tabId: parseInt(tab.tab_id),
                            changed: {},
                            viewController: tab.view_controller,
                            baseRoute: tab.base_route,
                            isSupportCedar: tab.is_support_cedar,
                            isV2: tab.is_v2,
                            desc: tab.description,
                            tabLabel: tab.tab_label,
                            iconColor: tab.tab_icon_color,
                            iconKey: tab.tab_icon_key,
                            iconUrl: tab.tab_icon_url,
                            seq: parseInt(tab.seq),
                            helperLabel: tab.helper_label,
                            helperLink: tab.helper_link,
                            active: parseInt(tab.is_active),
                            abbr: tab.abbr
                        };

                        fn.setTabData(tab.tab_id, tabData);
                    });

                    var tab = g_vars.more_tab; // @see AppTabsHelper::prepare_more_tab()
                    var moreTabData = {
                        tabId: parseInt(tab.tab_id),
                        changed: {},
                        viewController: tab.view_controller,
                        baseRoute: tab.base_route,
                        desc: tab.description,
                        tabLabel: tab.tab_label,
                        iconColor: tab.tab_icon_color,
                        iconKey: tab.tab_icon_key,
                        iconUrl: tab.tab_icon_url,
                        seq: parseInt(tab.seq),
                        helperLabel: tab.helper_label,
                        helperLink: tab.helper_link,
                        active: parseInt(tab.is_active),
                        abbr: tab.abbr
                    };

                    fn.setTabData(0, moreTabData);
                }

                // Set view controller opts
                if (json.tab_opts) {
                    fn.core.data.tab_opts = json.tab_opts;
                }

                // Set view controllers data.
                if (json.view_controllers) {
                    $.map(json.view_controllers, function (viewController) {
                        if (viewController.visible) {
                            fn.core.data.viewControllers[viewController.name] = {
                                name: viewController.name,
                                baseRoute: viewController.base_route,
                                label: viewController.proc_label,
                                desc: viewController.description,
                                detail: viewController.detail,
                                imgName: viewController.proc_img_name,
                                link: viewController.link,
                                linkLabel: viewController.link_label
                            };
                        }
                    });
                }

                if (json.industry_maps) {
                    for(var key in json.industry_maps) {
                        Flyup.prototype.setIndustryMap(key, json.industry_maps[key]);
                    }
                }
            },

            _protect: function () {
                $(window).on('beforeunload', function () {
                    if ( !/^lc\.dev\./.test(location.hostname) ) {
                        if (fn.core.data.changed || fn.tab.monitor()) {
                            return fn.phrasesBuild.msgBeforeUnload;
                        }
                    }
                });
            }
        },

        preloadImages: function() {
            var imgs = [
                asset + '/components/emoji/lib/emoji.png',
                asset + '/images/common/icons/dot-grey.png',
                asset + '/images/common/gif/box_rotate_loader-75.gif',
                asset + '/images/common/icons/close_hover_768.png',
                asset + '/images/common/icons/close_768.png',
                asset + '/images/common/icons/default_album.png',
                '/global/images/icons/tabicon_modern.png',
                '/global/images/icons/tabicon_modern_active.png',
                '/global/images/icons/tabicon_traditional.png',
                '/global/images/icons/tabicon_traditional_active.png'
            ];

            for(var i=0; i<imgs.length; i++) {
                var img_loader = new Image();
                img_loader.src = imgs[i];
            }
        },

        /**
         * Init script.
         * @return void
         */
        init: function () {

            fn.preloadImages();
            fn.core.init();

            if ( !fn.isCustomDesignEnabled() ) {
            	$("body").addClass("custom-design-disabled");
            }

            $('.page-header .help-info-dropdown a.help-info-design-app').parent('li').hide();
        }
    };

    return fn;
});