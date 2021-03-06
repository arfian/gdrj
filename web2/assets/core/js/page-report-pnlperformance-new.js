'use strict';

viewModel.breakdown = {};
var bkd = viewModel.breakdown;(function () {
	bkd.contentIsLoading = ko.observable(false);
	bkd.popupIsLoading = ko.observable(false);
	bkd.title = ko.observable('P&L Analytic');
	bkd.detail = ko.observableArray([]);
	bkd.limit = ko.observable(10);
	bkd.breakdownNote = ko.observable('');

	bkd.breakdownBy = ko.observable('customer.channelname');
	bkd.breakdownByFiscalYear = ko.observable('date.fiscal');
	bkd.oldBreakdownBy = ko.observable(bkd.breakdownBy());

	bkd.data = ko.observableArray([]);
	bkd.fiscalYear = ko.observable(rpt.value.FiscalYear());
	bkd.breakdownValue = ko.observableArray([]);
	bkd.level = ko.observable(1);
	bkd.isBreakdownBranch = ko.observable(false);

	bkd.breakdownBranch_Channels = ko.observableArray([]);
	bkd.breakdownBranch_ChannelRDNonRD = ko.observable('');
	bkd.breakdownBranch_SubChannel = ko.observable('');

	bkd.changeTo = function (d, title) {
		bkd.title(title);
		bkd.refresh();
	};

	bkd.isBreakdownBranchSubEnabled = function (d) {
		return ko.computed(function () {
			if (d == 'channel') {
				if (bkd.breakdownBranch_ChannelRDNonRD() != '') {
					return false;
				} else if (bkd.breakdownBranch_SubChannel() != '') {
					return false;
				}

				return true;
			} else if (d == 'rd-non-rd') {
				if (bkd.breakdownBranch_Channels().length > 0) {
					return false;
				} else if (bkd.breakdownBranch_SubChannel() != '') {
					return false;
				}

				return true;
			} else if (d == 'sub-channel') {
				if (bkd.breakdownBranch_Channels() != '') {
					return false;
				} else if (bkd.breakdownBranch_ChannelRDNonRD() != '') {
					return false;
				}

				return true;
			}

			return true;
		}, bkd);
	};

	bkd.breakdownChannel = ko.observable('');
	bkd.breakdownChannels = ko.observableArray([]);

	bkd.optionBreakdownRDNonRD = ko.observableArray([{ _id: "All", Name: "RD & Non RD" }, { _id: "RD", Name: "Only RD Sales" }, { _id: "NonRD", Name: "Non RD Sales" }]);

	bkd.isBreakdownChannel = ko.observable(false);
	bkd.breakdownChannelLocation = ko.observable('');
	bkd.optionBreakdownChannelLocations = ko.observableArray([{ _id: "zone", Name: "Zone" }, { _id: "region", Name: "Region" }, { _id: "areaname", Name: "City" }]);

	bkd.refresh = function () {
		var useCache = arguments.length <= 0 || arguments[0] === undefined ? false : arguments[0];

		if (bkd.breakdownValue().length == 0) {
			toolkit.showError('Please choose at least breakdown value');
			return;
		}

		$('.breakdown-view:not(#pnl-analysis)').empty();

		var param = {};
		param.pls = [];
		param.groups = rpt.parseGroups([bkd.breakdownBy()]);
		param.aggr = 'sum';
		param.filters = rpt.getFilterValue(false, bkd.fiscalYear);

		var breakdownValue = bkd.breakdownValue().filter(function (d) {
			return d != 'All';
		});
		if (breakdownValue.length > 0) {
			param.filters.push({
				Field: bkd.breakdownBy(),
				Op: '$in',
				Value: bkd.breakdownValue()
			});
		}

		if (bkd.breakdownChannels().length > 0) {
			param.groups.push('customer.reportsubchannel');
			param.filters.push({
				Field: 'customer.channelname',
				Op: '$in',
				Value: bkd.breakdownChannels()
			});

			bkd.level(2);
		}

		if (bkd.breakdownChannelLocation() != '') {
			param.groups.push('customer.' + bkd.breakdownChannelLocation());
			bkd.level(2);
		}

		// ====== BREAKDOWN BY BRANCH - CHANNEL

		if (bkd.breakdownBy() == 'customer.branchname') {
			if (bkd.breakdownBranch_Channels().length > 0) {
				param.groups.push('customer.channelname');
				param.filters.push({
					Field: 'customer.channelname',
					Op: '$in',
					Value: bkd.breakdownBranch_Channels()
				});
			} else if (bkd.breakdownBranch_ChannelRDNonRD() != '') {
				var values = [];

				switch (bkd.breakdownBranch_ChannelRDNonRD()) {
					case 'All':
						values = [];
						break;
					case 'RD':
						values = ['I1'];
						break;
					case 'NonRD':
						values = rpt.masterData.Channel().map(function (d) {
							return d._id;
						}).filter(function (d) {
							return d != 'I1';
						});
						break;
				}

				param.groups.push('customer.channelname');

				if (values.length > 0) {
					param.filters.push({
						Field: 'customer.channelname',
						Op: '$in',
						Value: values
					});
				}
			} else if (bkd.breakdownBranch_SubChannel() != '') {
				param.groups.push('customer.reportsubchannel');
				param.filters.push({
					Field: 'customer.channelname',
					Op: '$in',
					Value: [bkd.breakdownBranch_SubChannel()]
				});
			}
		}

		bkd.oldBreakdownBy(bkd.breakdownBy());
		bkd.contentIsLoading(true);

		var fetch = function fetch() {
			subchan.injectFilters(param.filters);
			toolkit.ajaxPost(viewModel.appName + "report/getpnldatanew", param, function (res) {
				if (res.Status == "NOK") {
					setTimeout(function () {
						fetch();
					}, 1000 * 5);
					return;
				}

				if (rpt.isEmptyData(res)) {
					bkd.contentIsLoading(false);
					return;
				}

				var date = moment(res.time).format("dddd, DD MMMM YYYY HH:mm:ss");
				bkd.breakdownNote('Last refreshed on: ' + date);

				var data = bkd.buildStructure(res.Data.Data);
				bkd.data(data);
				rpt.plmodels(res.Data.PLModels);
				bkd.emptyGrid();
				bkd.contentIsLoading(false);
				bkd.render();
				rpt.prepareEvents();
			}, function () {
				bkd.emptyGrid();
				bkd.contentIsLoading(false);
			}, {
				cache: useCache == true ? 'breakdown chart' : false
			});
		};

		fetch();
	};

	bkd.clickExpand = function (e) {
		var right = $(e).find('i.fa-chevron-right').length;
		var down = $(e).find('i.fa-chevron-down').length;
		if (right > 0) {
			if (['PL28', 'PL29A', 'PL31'].indexOf($(e).attr('idheaderpl')) > -1) {
				$('.pivot-pnl .table-header').css('width', rpt.pnlTableHeaderWidth());
				$('.pivot-pnl .table-content').css('margin-left', rpt.pnlTableHeaderWidth());
			}

			$(e).find('i').removeClass('fa-chevron-right');
			$(e).find('i').addClass('fa-chevron-down');
			$('tr[idparent=' + e.attr('idheaderpl') + ']').css('display', '');
			$('tr[idcontparent=' + e.attr('idheaderpl') + ']').css('display', '');
			$('tr[statusvaltemp=hide]').css('display', 'none');
			rpt.refreshHeight(e.attr('idheaderpl'));
		}
		if (down > 0) {
			if (['PL28', 'PL29A', 'PL31'].indexOf($(e).attr('idheaderpl')) > -1) {
				$('.pivot-pnl .table-header').css('width', '');
				$('.pivot-pnl .table-content').css('margin-left', '');
			}

			$(e).find('i').removeClass('fa-chevron-down');
			$(e).find('i').addClass('fa-chevron-right');
			$('tr[idparent=' + e.attr('idheaderpl') + ']').css('display', 'none');
			$('tr[idcontparent=' + e.attr('idheaderpl') + ']').css('display', 'none');
			rpt.hideAllChild(e.attr('idheaderpl'));
		}
	};

	bkd.emptyGrid = function () {
		$('#pnl-analysis').replaceWith('<div class="breakdown-view ez" id="pnl-analysis"></div>');
	};

	bkd.renderDetailSalesTrans = function (breakdown) {
		bkd.popupIsLoading(true);
		$('#modal-detail-ledger-summary').appendTo($('body'));
		$('#modal-detail-ledger-summary').modal('show');

		var columns = [
		// { field: '_id', title: 'ID', width: 100, locked: true },
		{ field: 'date', title: 'Date', width: 150, locked: true, template: function template(d) {
				return moment(d.date).format('DD/MM/YYYY HH:mm');
			} }, { field: "grossamount", headerTemplate: '<div class="align-right">Gross</div>', width: 100, format: '{0:n0}', attributes: { class: 'align-right' } }, { field: "discountamount", headerTemplate: '<div class="align-right">Discount</div>', width: 100, format: '{0:n0}', attributes: { class: 'align-right' } }, { field: "netamount", headerTemplate: '<div class="align-right">Net Sales</div>', width: 100, format: '{0:n0}', attributes: { class: 'align-right' } }, { field: "salesqty", headerTemplate: '<div class="align-right">Sales Qty</div>', width: 100, format: '{0:n0}', attributes: { class: 'align-right' } }, { field: "customer.branchname", title: 'Branch', width: 100 }, { field: "product.name", title: 'Product', width: 250 }, { field: "product.brand", title: 'Brand', width: 100 }];

		var config = {
			dataSource: {
				transport: {
					read: function read(options) {
						var param = options.data;
						param.tablename = "browsesalestrxs";
						param[bkd.breakdownBy()] = [breakdown];

						if (toolkit.isUndefined(param.page)) {
							param = $.extend(true, param, {
								take: 5,
								skip: 0,
								page: 1,
								pageSize: 5
							});
						}

						$.ajax({
							type: "POST",
							url: "/databrowser/getdatabrowser",
							contentType: "application/json; charset=utf-8",
							dataType: 'json',
							data: JSON.stringify(param),
							success: function success(res) {
								bkd.popupIsLoading(false);
								setTimeout(function () {
									options.success(res.data);
								}, 200);
							},
							error: function error() {
								bkd.popupIsLoading(false);
							}
						});
					},
					pageSize: 5
				},
				schema: {
					data: function data(d) {
						return d.DataValue;
					},
					total: function total(d) {
						return d.DataCount;
					}
				},
				serverPaging: true,
				columns: [],
				pageSize: 5
			},
			sortable: true,
			pageable: true,
			scrollable: true,
			columns: columns
		};

		$('.grid-detail').replaceWith('<div class="grid-detail"></div>');
		$('.grid-detail').kendoGrid(config);
	};

	bkd.renderDetail = function (plcode, breakdowns) {
		bkd.popupIsLoading(true);
		$('#modal-detail-ledger-summary .modal-title').html('Detail');
		$('#modal-detail-ledger-summary').appendTo($('body'));
		$('#modal-detail-ledger-summary').modal('show');

		var titleParts = [];
		for (var p in breakdowns) {
			if (breakdowns.hasOwnProperty(p)) {
				titleParts.push(breakdowns[p]);
			}
		}

		$('#modal-detail-ledger-summary .modal-title').html('Detail of ' + titleParts.join(' '));

		var columns = [{ title: 'Date', width: 120, locked: true, footerTemplate: 'Total :', template: function template(d) {
				return moment(d.date.date).format('DD/MM/YYYY HH:mm');
			}, attributes: { class: 'bold' } },
		// { field: `pldatas.${plcode}.amount`, width: 120, aggregates: ["sum"], headerTemplate: "<div class='align-right'>Amount</div>", footerTemplate: (d) => d[`pldatas.${plcode}.amount`].sum, format: '{0:n2}', attributes: { class: 'align-right' } },
		{ field: 'grossamount', width: 90, aggregates: ["sum"], headerTemplate: "<div class='align-right'>Gross</div>", /** footerTemplate: (d) => `<div class="align-right">${kendo.toString(d.grossamount.sum, 'n0')}</div>`,  */format: '{0:n2}', attributes: { class: 'align-right' } }, { field: 'discountamount', width: 90, aggregates: ["sum"], headerTemplate: "<div class='align-right'>Discount</div>", /** footerTemplate: (d) => `<div class="align-right">${kendo.toString(d.discountamount.sum, 'n0')}</div>`,  */format: '{0:n2}', attributes: { class: 'align-right' } }, { field: 'netamount', width: 90, aggregates: ["sum"], headerTemplate: "<div class='align-right'>Net Sales</div>", /** footerTemplate: (d) => `<div class="align-right">${kendo.toString(d.netamount.sum, 'n0')}</div>`,  */format: '{0:n2}', attributes: { class: 'align-right' } },
		// { title: 'Cost Center', template: (d) => toolkit.redefine(toolkit.redefine(d.cc, {}).name, ''), width: 250 },
		{ title: 'Outlet', template: function template(d) {
				return toolkit.redefine(toolkit.redefine(d.customer, {}).name, '');
			}, width: 200 }, { title: 'Branch', template: function template(d) {
				return toolkit.redefine(toolkit.redefine(d.customer, {}).branchname, '');
			}, width: 150 }, { title: 'Channel', template: function template(d) {
				return toolkit.redefine(toolkit.redefine(d.customer, {}).channelname, '');
			}, width: 150 }, { title: 'Brand', template: function template(d) {
				return toolkit.redefine(toolkit.redefine(d.product, {}).brand, '');
			}, width: 100 }, { title: 'Product', template: function template(d) {
				return toolkit.redefine(toolkit.redefine(d.product, {}).name, '');
			}, width: 250 }];

		var config = {
			dataSource: {
				transport: {
					read: function read(options) {
						var param = options.data;
						param.filters = [];

						for (var _p in breakdowns) {
							if (breakdowns.hasOwnProperty(_p)) {
								param.filters.push({
									field: _p.replace(/_id_/g, '').replace(/_/g, '.'),
									op: "$eq",
									value: breakdowns[_p]
								});
							}
						}

						if (toolkit.isUndefined(param.page)) {
							param = $.extend(true, param, {
								take: 5,
								skip: 0,
								page: 1,
								pageSize: 5
							});
						}

						$.ajax({
							type: "POST",
							url: "/report/getpnldetail",
							contentType: "application/json; charset=utf-8",
							dataType: 'json',
							data: JSON.stringify(param),
							success: function success(res) {
								bkd.popupIsLoading(false);
								setTimeout(function () {
									console.log("++++", res);
									options.success(res.Data);
								}, 200);
							},
							error: function error() {
								bkd.popupIsLoading(false);
							}
						});
					},
					pageSize: 5
				},
				schema: {
					data: function data(d) {
						return d.DataValue;
					},
					total: function total(d) {
						return d.DataCount;
					}
				},
				//       aggregates: [
				// 	{ field: "netamount", aggregate: "sum" },
				// 	{ field: "grossamount", aggregate: "sum" },
				// 	{ field: "discountamount", aggregate: "sum" },
				// 	{ field: `pldatas.${plcode}.amount`, aggregate: 'sum' }
				// ],
				serverPaging: true,
				pageSize: 5
			},
			sortable: true,
			pageable: true,
			scrollable: true,
			columns: columns,
			dataBound: function dataBound(d) {
				$('.grid-detail .k-pager-nav.k-pager-last').hide();

				setTimeout(function () {
					var pager = $('.grid-detail .k-pager-info');
					var text = 'rows ' + pager.html().split(" ").slice(0, 3).join(" ");
					pager.html(text);
				}, 10);
			}
		};

		console.log("======", config);

		$('.grid-detail').replaceWith('<div class="grid-detail"></div>');
		$('.grid-detail').kendoGrid(config);
	};

	bkd.buildStructure = function (data) {
		var groupThenMap = function groupThenMap(data, group) {
			var op1 = _.groupBy(data, function (d) {
				return group(d);
			});
			var op2 = _.map(op1, function (v, k) {
				var key = { _id: k, subs: v };
				var sample = v[0];

				var _loop = function _loop(prop) {
					if (sample.hasOwnProperty(prop) && prop != '_id') {
						key[prop] = toolkit.sum(v, function (d) {
							return d[prop];
						});
					}
				};

				for (var prop in sample) {
					_loop(prop);
				}

				return key;
			});

			return op2;
		};

		if (bkd.breakdownChannels().length > 0) {
			var _parsed = groupThenMap(data, function (d) {
				return d._id['_id_' + toolkit.replace(bkd.breakdownBy(), '.', '_')];
			}).map(function (d) {
				var subs = groupThenMap(d.subs, function (e) {
					return e._id._id_customer_reportsubchannel;
				}).map(function (e) {
					e.breakdowns = e.subs[0]._id;
					d.count = 1;
					return e;
				});

				d.subs = _.orderBy(subs, function (e) {
					return e.PL8A;
				}, 'desc');
				d.breakdowns = d.subs[0]._id;
				d.count = d.subs.length;
				return d;
			});

			bkd.level(2);
			var _newParsed = _.orderBy(_parsed, function (d) {
				return d.PL8A;
			}, 'desc');
			return _newParsed;
		}

		if (bkd.breakdownChannelLocation() != '') {
			var _parsed2 = groupThenMap(data, function (d) {
				return d._id['_id_' + toolkit.replace(bkd.breakdownBy(), '.', '_')];
			}).map(function (d) {
				var subs = groupThenMap(d.subs, function (e) {
					return e._id['_id_customer_' + bkd.breakdownChannelLocation()];
				}).map(function (e) {
					e.breakdowns = e.subs[0]._id;
					d.count = 1;
					return e;
				});

				d.subs = _.orderBy(subs, function (e) {
					return e.PL8A;
				}, 'desc');
				d.breakdowns = d.subs[0]._id;
				d.count = d.subs.length;
				return d;
			});

			bkd.level(2);
			var _newParsed2 = _.orderBy(_parsed2, function (d) {
				return d.PL8A;
			}, 'desc');
			return _newParsed2;
		}

		if (bkd.breakdownBy() == 'customer.branchname') {
			if (bkd.breakdownBranch_Channels().length > 0) {
				var _parsed3 = groupThenMap(data, function (d) {
					return d._id['_id_customer_branchname'];
				}).map(function (d) {
					var subs = groupThenMap(d.subs, function (e) {
						return e._id['_id_customer_channelname'];
					}).map(function (e) {
						e.breakdowns = e.subs[0]._id;
						d.count = 1;
						return e;
					});

					d.subs = _.orderBy(subs, function (e) {
						return e.PL8A;
					}, 'desc');
					d.breakdowns = d.subs[0]._id;
					d.count = d.subs.length;
					return d;
				});

				bkd.level(2);
				var _newParsed3 = _.orderBy(_parsed3, function (d) {
					return d.PL8A;
				}, 'desc');
				return _newParsed3;
			}

			if (bkd.breakdownBranch_ChannelRDNonRD() != '') {
				var injectTotal = function injectTotal(data) {
					var renderTotalColumn = function renderTotalColumn(d) {
						var totalColumn = {};
						totalColumn._id = 'Total';
						totalColumn.count = 1;
						totalColumn.excludeFromTotal = true;

						var totalSubColumn = {};
						totalSubColumn._id = 'Total';
						totalSubColumn.count = 1;
						totalSubColumn.excludeFromTotal = true;

						var _loop2 = function _loop2(p) {
							if (d.subs[0].hasOwnProperty(p) && p.search('PL') > -1) {
								totalColumn[p] = toolkit.sum(d.subs, function (e) {
									return e[p];
								});
								totalSubColumn[p] = toolkit.sum(d.subs, function (e) {
									return e[p];
								});
							}
						};

						for (var p in d.subs[0]) {
							_loop2(p);
						}

						totalColumn.subs = [totalSubColumn];
						return totalColumn;
					};

					data.forEach(function (d) {
						var totalColumn = renderTotalColumn(d);
						d.subs = [totalColumn].concat(d.subs);
						d.count = toolkit.sum(d.subs, function (e) {
							return e.count;
						});
					});
				};

				var _parsed4 = groupThenMap(data, function (d) {
					return d._id['_id_customer_branchname'];
				}).map(function (d) {
					var subs = groupThenMap(d.subs, function (e) {
						return e._id._id_customer_channelid == 'I1' ? 'RD' : 'Non RD';
					}).map(function (e) {
						e.breakdowns = e.subs[0]._id;
						d.count = 1;
						return e;
					});

					d.subs = _.orderBy(subs, function (e) {
						return e.PL8A;
					}, 'desc');
					d.breakdowns = d.subs[0]._id;
					d.count = d.subs.length;
					return d;
				});

				bkd.level(2);
				// if (bkd.breakdownBranch_ChannelRDNonRD() == 'All') {
				// 	injectTotal(parsed)
				// }
				var _newParsed4 = _.orderBy(_parsed4, function (d) {
					return d.PL8A;
				}, 'desc');
				return _newParsed4;
			}

			if (bkd.breakdownBranch_SubChannel() != '') {
				var _parsed5 = groupThenMap(data, function (d) {
					return d._id['_id_customer_branchname'];
				}).map(function (d) {
					var subs = groupThenMap(d.subs, function (e) {
						return e._id._id_customer_reportsubchannel;
					}).map(function (e) {
						e.breakdowns = e.subs[0]._id;
						d.count = 1;
						return e;
					});

					d.subs = _.orderBy(subs, function (e) {
						return e.PL8A;
					}, 'desc');
					d.breakdowns = d.subs[0]._id;
					d.count = d.subs.length;
					return d;
				});

				bkd.level(2);
				var _newParsed5 = _.orderBy(_parsed5, function (d) {
					return d.PL8A;
				}, 'desc');
				return _newParsed5;
			}
		}

		var parsed = groupThenMap(data, function (d) {
			return d._id['_id_' + toolkit.replace(bkd.breakdownBy(), '.', '_')];
		}).map(function (d) {
			d.breakdowns = d.subs[0]._id;
			d.count = 1;

			return d;
		});

		bkd.level(1);
		var newParsed = _.orderBy(parsed, function (d) {
			return d.PL8A;
		}, 'desc');
		return newParsed;
	};

	bkd.render = function () {
		if (bkd.data().length == 0) {
			$('#pnl-analysis').html('No data found.');
			return;
		}

		// reorder
		if (bkd.breakdownBy() == "customer.channelname") {
			var prev = _.orderBy(bkd.data(), function (d) {
				if (d._id == "General Trade") {
					var _mt = bkd.data().find(function (e) {
						return e._id == "Modern Trade";
					});
					if (toolkit.isDefined(_mt)) {
						return _mt.PL8A - 10;
					}
				}

				return d.PL8A;
			}, 'desc');

			var mt = bkd.data().find(function (e) {
				return e._id == "Modern Trade";
			});
			if (toolkit.isDefined(mt)) {
				mt._id = 'Branch Modern Trade';
			}

			var gt = bkd.data().find(function (e) {
				return e._id == "General Trade";
			});
			if (toolkit.isDefined(gt)) {
				gt._id = 'Branch General Trade';
			}

			bkd.data(prev);
		}

		// ========================= TABLE STRUCTURE

		var percentageWidth = 100;

		var wrapper = toolkit.newEl('div').addClass('pivot-pnl-branch pivot-pnl').appendTo($('#pnl-analysis'));

		var tableHeaderWrap = toolkit.newEl('div').addClass('table-header').appendTo(wrapper);

		var tableHeader = toolkit.newEl('table').addClass('table').appendTo(tableHeaderWrap);

		var tableContentWrap = toolkit.newEl('div').appendTo(wrapper).addClass('table-content');

		var tableContent = toolkit.newEl('table').addClass('table').appendTo(tableContentWrap);

		var trHeader = toolkit.newEl('tr').appendTo(tableHeader);

		toolkit.newEl('th').html('P&L').css('height', rpt.rowHeaderHeight() * bkd.level() + 'px').attr('data-rowspan', bkd.level()).css('vertical-align', 'middle').addClass('cell-percentage-header').appendTo(trHeader);

		toolkit.newEl('th').html('Total').css('height', rpt.rowHeaderHeight() * bkd.level() + 'px').attr('data-rowspan', bkd.level()).css('vertical-align', 'middle').addClass('cell-percentage-header align-right').appendTo(trHeader);

		toolkit.newEl('th').html('% of N Sales').css('height', rpt.rowHeaderHeight() * bkd.level() + 'px').css('vertical-align', 'middle').css('font-weight', 'normal').css('font-style', 'italic').width(percentageWidth - 20).attr('data-rowspan', bkd.level()).addClass('cell-percentage-header align-right').appendTo(trHeader);

		var trContents = [];
		for (var i = 0; i < bkd.level(); i++) {
			trContents.push(toolkit.newEl('tr').appendTo(tableContent).css('height', rpt.rowHeaderHeight() + 'px'));
		}

		// ========================= BUILD HEADER

		var data = bkd.data();

		var columnWidth = 130;
		var totalColumnWidth = 0;
		var pnlTotalSum = 0;
		var dataFlat = [];

		var countWidthThenPush = function countWidthThenPush(thheader, each, key) {
			var currentColumnWidth = each._id.length * (bkd.breakdownBy() == 'customer.channelname' ? 7 : 10);
			if (currentColumnWidth < columnWidth) {
				currentColumnWidth = columnWidth;
			}

			if (each.hasOwnProperty('width')) {
				currentColumnWidth = each.width;
			}

			each.key = key.join('_');
			dataFlat.push(each);

			totalColumnWidth += currentColumnWidth;
			thheader.width(currentColumnWidth);
		};

		data.forEach(function (lvl1, i) {
			var thheader1 = toolkit.newEl('th').html(lvl1._id).attr('colspan', lvl1.count).addClass('align-center').css('border-top', 'none').appendTo(trContents[0]);

			if (bkd.level() == 1) {
				countWidthThenPush(thheader1, lvl1, [lvl1._id]);

				totalColumnWidth += percentageWidth;
				var thheader1p = toolkit.newEl('th').html('% of N Sales').width(percentageWidth).addClass('align-center').css('font-weight', 'normal').css('font-style', 'italic').css('border-top', 'none').appendTo(trContents[0]);

				return;
			}
			thheader1.attr('colspan', lvl1.count * 2);

			lvl1.subs.forEach(function (lvl2, j) {
				var thheader2 = toolkit.newEl('th').html(lvl2._id).addClass('align-center').appendTo(trContents[1]);

				if (bkd.level() == 2) {
					countWidthThenPush(thheader2, lvl2, [lvl1._id, lvl2._id]);

					totalColumnWidth += percentageWidth;
					var _thheader1p = toolkit.newEl('th').html('% of N Sales').width(percentageWidth).addClass('align-center').css('font-weight', 'normal').css('font-style', 'italic').appendTo(trContents[1]);

					return;
				}
				thheader2.attr('colspan', lvl2.count);
			});
		});

		tableContent.css('min-width', totalColumnWidth);

		// ========================= CONSTRUCT DATA

		var plmodels = _.sortBy(rpt.plmodels(), function (d) {
			return parseInt(d.OrderIndex.replace(/PL/g, ''));
		});
		var exceptions = ["PL94C" /* "Operating Income" */, "PL39B" /* "Earning Before Tax" */, "PL41C" /* "Earning After Tax" */, "PL6A" /* "Discount" */];
		var netSalesPLCode = 'PL8A';
		var netSalesRow = {};
		var grossSalesPLCode = 'PL0';
		var grossSalesRow = {};
		var discountActivityPLCode = 'PL7A';
		var rows = [];

		rpt.fixRowValue(dataFlat);

		console.log("dataFlat", dataFlat);

		dataFlat.forEach(function (e) {
			var breakdown = e.key;
			netSalesRow[breakdown] = e[netSalesPLCode];
			grossSalesRow[breakdown] = e[grossSalesPLCode];
		});

		plmodels.forEach(function (d) {
			var row = { PNL: d.PLHeader3, PLCode: d._id, PNLTotal: 0, Percentage: 0 };
			dataFlat.forEach(function (e) {
				var breakdown = e.key;
				var value = e['' + d._id];
				row[breakdown] = value;

				if (toolkit.isDefined(e.excludeFromTotal)) {
					return;
				}

				row.PNLTotal += value;
			});
			dataFlat.forEach(function (e) {
				var breakdown = e.key;
				var percentage = toolkit.number(row[breakdown] / row.PNLTotal) * 100;
				percentage = toolkit.number(percentage);

				if (d._id == discountActivityPLCode) {
					percentage = toolkit.number(row[breakdown] / grossSalesRow[breakdown]) * 100;
				} else if (d._id != netSalesPLCode) {
					percentage = toolkit.number(row[breakdown] / netSalesRow[breakdown]) * 100;
				}

				if (percentage < 0) percentage = percentage * -1;

				row[breakdown + ' %'] = percentage;
			});

			if (exceptions.indexOf(row.PLCode) > -1) {
				return;
			}

			rows.push(row);
		});

		console.log("rows", rows);

		var TotalNetSales = _.find(rows, function (r) {
			return r.PLCode == netSalesPLCode;
		}).PNLTotal;
		var TotalGrossSales = _.find(rows, function (r) {
			return r.PLCode == grossSalesPLCode;
		}).PNLTotal;
		rows.forEach(function (d, e) {
			var TotalPercentage = d.PNLTotal / TotalNetSales * 100;
			if (d.PLCode == discountActivityPLCode) {
				TotalPercentage = d.PNLTotal / TotalGrossSales * 100;
			}

			if (TotalPercentage < 0) TotalPercentage = TotalPercentage * -1;
			rows[e].Percentage = toolkit.number(TotalPercentage);
		});

		// ========================= PLOT DATA

		rows.forEach(function (d, i) {
			pnlTotalSum += d.PNLTotal;

			var PL = d.PLCode;
			PL = PL.replace(/\s+/g, '');
			var trHeader = toolkit.newEl('tr').addClass('header' + PL).attr('idheaderpl', PL).attr('data-row', 'row-' + i).css('height', rpt.rowContentHeight() + 'px').appendTo(tableHeader);

			trHeader.on('click', function () {
				bkd.clickExpand(trHeader);
			});

			toolkit.newEl('td').html('<i></i>' + d.PNL).appendTo(trHeader);

			var pnlTotal = kendo.toString(d.PNLTotal, 'n0');
			toolkit.newEl('td').html(pnlTotal).addClass('align-right').appendTo(trHeader);

			toolkit.newEl('td').html(kendo.toString(d.Percentage, 'n2') + ' %').addClass('align-right').appendTo(trHeader);

			var trContent = toolkit.newEl('tr').addClass('column' + PL).attr('idpl', PL).attr('data-row', 'row-' + i).css('height', rpt.rowContentHeight() + 'px').appendTo(tableContent);

			dataFlat.forEach(function (e, f) {
				var key = e.key;
				var value = kendo.toString(d[key], 'n0');
				var percentage = kendo.toString(d[key + ' %'], 'n2') + ' %';

				if ($.trim(value) == '') {
					value = 0;
				}

				var cell = toolkit.newEl('td').html(value).addClass('align-right').appendTo(trContent);

				var cellPercentage = toolkit.newEl('td').html(percentage).addClass('align-right').appendTo(trContent);

				$([cell, cellPercentage]).on('click', function () {
					bkd.renderDetail(d.PLCode, e.breakdowns);
				});
			});

			var boolStatus = false;
			trContent.find('td').each(function (a, e) {
				if ($(e).text() != '0' && $(e).text() != '0.00 %') {
					boolStatus = true;
				}
			});

			if (boolStatus) {
				trContent.attr('statusval', 'show');
				trHeader.attr('statusval', 'show');
			} else {
				trContent.attr('statusval', 'hide');
				trHeader.attr('statusval', 'hide');
			}
		});

		// ========================= CONFIGURE THE HIRARCHY
		rpt.buildGridLevels(rows);
	};

	bkd.optionBreakdownValues = ko.observableArray([]);
	bkd.breakdownValueAll = { _id: 'All', Name: 'All' };
	bkd.changeBreakdown = function () {
		var all = bkd.breakdownValueAll;
		var map = function map(arr) {
			return arr.map(function (d) {
				if ("customer.channelname" == bkd.breakdownBy()) {
					return d;
				}
				if ("customer.keyaccount" == bkd.breakdownBy()) {
					return { _id: d._id, Name: d._id };
				}

				return { _id: d.Name, Name: d.Name };
			});
		};
		setTimeout(function () {
			bkd.isBreakdownBranch(false);
			bkd.breakdownBranch_Channels([]);
			bkd.breakdownBranch_ChannelRDNonRD('');
			bkd.breakdownBranch_SubChannel('');

			bkd.isBreakdownChannel(false);
			// bkd.breakdownChannels([])
			// bkd.breakdownChannelLocation([])

			switch (bkd.breakdownBy()) {
				case "customer.areaname":
					bkd.optionBreakdownValues([all].concat(map(rpt.masterData.Area())));
					bkd.breakdownValue([all._id]);
					break;
				case "customer.region":
					bkd.optionBreakdownValues([all].concat(map(rpt.masterData.Region())));
					bkd.breakdownValue([all._id]);
					break;
				case "customer.zone":
					bkd.optionBreakdownValues([all].concat(map(rpt.masterData.Zone())));
					bkd.breakdownValue([all._id]);
					break;
				case "product.brand":
					bkd.optionBreakdownValues([all].concat(map(rpt.masterData.Brand())));
					bkd.breakdownValue([all._id]);
					break;
				case "customer.branchname":
					bkd.optionBreakdownValues([all].concat(map(rpt.masterData.Branch())));
					bkd.breakdownValue([all._id]);

					// bkd.isBreakdownBranch(true)
					break;
				case "customer.channelname":
					bkd.optionBreakdownValues([all].concat(map(rpt.masterData.Channel())));
					bkd.breakdownValue([all._id]);

					bkd.isBreakdownChannel(true);
					bkd.breakdownChannels([]);
					break;
				case "customer.keyaccount":
					bkd.optionBreakdownValues([all].concat(map(rpt.masterData.KeyAccount())));
					bkd.breakdownValue([all._id]);
					break;
			}
		}, 100);
	};
	bkd.changeBreakdownValue = function () {
		var all = bkd.breakdownValueAll;
		setTimeout(function () {
			var condA1 = bkd.breakdownValue().length == 2;
			var condA2 = bkd.breakdownValue().indexOf(all._id) == 0;
			if (condA1 && condA2) {
				bkd.breakdownValue.remove(all._id);
				return;
			}

			var condB1 = bkd.breakdownValue().length > 1;
			var condB2 = bkd.breakdownValue().reverse()[0] == all._id;
			if (condB1 && condB2) {
				bkd.breakdownValue([all._id]);
				return;
			}

			var condC1 = bkd.breakdownValue().length == 0;
			if (condC1) {
				bkd.breakdownValue([all._id]);
			}
		}, 100);
	};
})();

viewModel.RDvsBranchView2 = {};
var v2 = viewModel.RDvsBranchView2;(function () {
	var colors = ['rgb(17, 134, 212)', 'rgb(32, 162, 87)', 'rgb(234, 144, 0)'];

	v2.contentIsLoading = ko.observable(false);

	v2.breakdownBy = ko.observable('customer.channelname');
	v2.breakdownByFiscalYear = ko.observable('date.fiscal');

	v2.data = ko.observableArray([]);
	v2.fiscalYear = ko.observable(rpt.value.FiscalYear());
	v2.level = ko.observable(2);

	v2.refresh = function () {
		var useCache = arguments.length <= 0 || arguments[0] === undefined ? false : arguments[0];

		$('.breakdown-view:not(.grid-breakdown-channel)').empty();

		var param = {};
		param.pls = [];
		param.groups = rpt.parseGroups([v2.breakdownBy()]);
		param.aggr = 'sum';
		param.flag = 'branch-vs-rd-only-mt-gt';
		param.filters = rpt.getFilterValue(false, v2.fiscalYear);

		v2.contentIsLoading(true);

		var fetch = function fetch() {
			subchan.injectFilters(param.filters);
			toolkit.ajaxPost(viewModel.appName + "report/getpnldatanew", param, function (res) {
				if (res.Status == "NOK") {
					setTimeout(function () {
						fetch();
					}, 1000 * 5);
					return;
				}

				if (rpt.isEmptyData(res)) {
					v2.contentIsLoading(false);
					return;
				}

				v2.data(v2.buildStructure(res.Data.Data));
				rpt.plmodels(res.Data.PLModels);
				v2.emptyGrid();
				v2.contentIsLoading(false);
				v2.render();
				rpt.prepareEvents();
			}, function () {
				v2.emptyGrid();
				v2.contentIsLoading(false);
			});
		};

		fetch();
	};

	v2.clickExpand = function (e) {
		var right = $(e).find('i.fa-chevron-right').length;
		var down = $(e).find('i.fa-chevron-down').length;
		if (right > 0) {
			if (['PL28', 'PL29A', 'PL31'].indexOf($(e).attr('idheaderpl')) > -1) {
				$('.pivot-pnl .table-header').css('width', rpt.pnlTableHeaderWidth());
				$('.pivot-pnl .table-content').css('margin-left', rpt.pnlTableHeaderWidth());
			}

			$(e).find('i').removeClass('fa-chevron-right');
			$(e).find('i').addClass('fa-chevron-down');
			$('tr[idparent=' + e.attr('idheaderpl') + ']').css('display', '');
			$('tr[idcontparent=' + e.attr('idheaderpl') + ']').css('display', '');
			$('tr[statusvaltemp=hide]').css('display', 'none');
			rpt.refreshHeight(e.attr('idheaderpl'));
		}
		if (down > 0) {
			if (['PL28', 'PL29A', 'PL31'].indexOf($(e).attr('idheaderpl')) > -1) {
				$('.pivot-pnl .table-header').css('width', '');
				$('.pivot-pnl .table-content').css('margin-left', '');
			}

			$(e).find('i').removeClass('fa-chevron-down');
			$(e).find('i').addClass('fa-chevron-right');
			$('tr[idparent=' + e.attr('idheaderpl') + ']').css('display', 'none');
			$('tr[idcontparent=' + e.attr('idheaderpl') + ']').css('display', 'none');
			rpt.hideAllChild(e.attr('idheaderpl'));
		}
	};

	v2.emptyGrid = function () {
		$('.grid-breakdown-channel').replaceWith('<div class="breakdown-view ez grid-breakdown-channel"></div>');
	};

	v2.buildStructure = function (data) {
		var groupThenMap = function groupThenMap(data, group) {
			var op1 = _.groupBy(data, function (d) {
				return group(d);
			});
			var op2 = _.map(op1, function (v, k) {
				var key = { _id: k, subs: v };
				var sample = v[0];

				var _loop3 = function _loop3(prop) {
					if (sample.hasOwnProperty(prop) && prop != '_id') {
						key[prop] = toolkit.sum(v, function (d) {
							return d[prop];
						});
					}
				};

				for (var prop in sample) {
					_loop3(prop);
				}

				return key;
			});

			return op2;
		};

		var parsed = groupThenMap(data, function (d) {
			return d._id._id_customer_channelname;
		}).map(function (d) {
			var subs = groupThenMap(d.subs, function (e) {
				return e._id._id_branchrd;
			}).map(function (e) {
				if (d._id == 'Total') {
					e.excludeFromTotal = true;
				}

				e.breakdowns = e.subs[0]._id;
				e.count = 1;
				return e;
			});

			d.subs = _.orderBy(subs, function (e) {
				return e._id;
			}, 'asc');
			d.breakdowns = d.subs[0]._id;
			d.count = d.subs.length;

			var total = {};
			total._id = 'Total';
			total.key = 'Total';
			total.excludeFromTotal = true;

			var _loop4 = function _loop4(prop) {
				if (subs[0].hasOwnProperty(prop) && prop.search('PL') > -1) {
					var val = subs[0][prop];
					total[prop] = toolkit.sum(subs, function (f) {
						return f[prop];
					});
				}
			};

			for (var prop in subs[0]) {
				_loop4(prop);
			}d.subs = [total].concat(d.subs);
			d.count++;

			return d;
		});

		console.log('------>>>>-------', parsed);

		v2.level(2);
		var newParsed = _.orderBy(parsed, function (d) {
			return d.PL8A;
		}, 'desc');
		return newParsed;
	};

	v2.render = function () {
		var container = $('.grid-breakdown-channel');
		if (v2.data().length == 0) {
			container.html('No data found.');
			return;
		}

		// ========================= TABLE STRUCTURE

		var wrapper = toolkit.newEl('div').addClass('pivot-pnl-branch pivot-pnl').appendTo(container);

		var tableHeaderWrap = toolkit.newEl('div').addClass('table-header').appendTo(wrapper);

		var tableHeader = toolkit.newEl('table').addClass('table').appendTo(tableHeaderWrap);

		var tableContentWrap = toolkit.newEl('div').appendTo(wrapper).addClass('table-content');

		var tableContent = toolkit.newEl('table').addClass('table').appendTo(tableContentWrap);

		var trHeader = toolkit.newEl('tr').appendTo(tableHeader);

		toolkit.newEl('th').html('P&L').css('height', rpt.rowHeaderHeight() * v2.level() + 'px').attr('data-rowspan', v2.level()).css('vertical-align', 'middle').addClass('cell-percentage-header').appendTo(trHeader);

		toolkit.newEl('th').html('Total').css('height', rpt.rowHeaderHeight() * v2.level() + 'px').attr('data-rowspan', v2.level()).css('vertical-align', 'middle').addClass('cell-percentage-header align-right').appendTo(trHeader);

		toolkit.newEl('th').html('% of N Sales').css('height', rpt.rowHeaderHeight() * v2.level() + 'px').css('vertical-align', 'middle').css('font-weight', 'normal').css('font-style', 'italic').width(percentageWidth - 20).attr('data-rowspan', v2.level()).appendTo(trHeader);

		var trContents = [];
		for (var i = 0; i < v2.level(); i++) {
			trContents.push(toolkit.newEl('tr').appendTo(tableContent).css('height', rpt.rowHeaderHeight() + 'px'));
		}

		// ========================= BUILD HEADER

		var data = v2.data();

		var columnWidth = 120;
		var totalColumnWidth = 0;
		var pnlTotalSum = 0;
		var dataFlat = [];
		var percentageWidth = 100;

		var countWidthThenPush = function countWidthThenPush(thheader, each, key) {
			var currentColumnWidth = columnWidth;

			each.key = key.join('_');
			dataFlat.push(each);

			totalColumnWidth += currentColumnWidth;
			thheader.width(currentColumnWidth);
		};

		data.forEach(function (lvl1, i) {
			var thheader1 = toolkit.newEl('th').html(lvl1._id).attr('colspan', lvl1.count).addClass('align-center').appendTo(trContents[0]).css('background-color', colors[i]).css('color', 'white').css('border-top', 'none');

			if (v2.level() == 1) {
				countWidthThenPush(thheader1, lvl1, [lvl1._id]);

				totalColumnWidth += percentageWidth;
				var thheader1p = toolkit.newEl('th').html('% of N Sales').css('font-weight', 'normal').css('font-style', 'italic').width(percentageWidth).addClass('align-center').appendTo(trContents[0]).css('border-top', 'none');

				return;
			}
			thheader1.attr('colspan', lvl1.count * 2);

			lvl1.subs.forEach(function (lvl2, j) {
				var thheader2 = toolkit.newEl('th').html(lvl2._id).addClass('align-center').appendTo(trContents[1]);

				if (lvl2._id == 'Total') {
					thheader2.css('background-color', 'rgb(116, 149, 160)');
					thheader2.css('color', 'white');
				}

				if (v2.level() == 2) {
					countWidthThenPush(thheader2, lvl2, [lvl1._id, lvl2._id]);

					totalColumnWidth += percentageWidth;
					var _thheader1p2 = toolkit.newEl('th').html('% of N Sales').css('font-weight', 'normal').css('font-style', 'italic').width(percentageWidth).addClass('align-center').appendTo(trContents[1]);

					if (lvl2._id == 'Total') {
						_thheader1p2.css('background-color', 'rgb(116, 149, 160)');
						_thheader1p2.css('color', 'white');
					}

					return;
				}
				thheader2.attr('colspan', lvl2.count);
			});
		});

		tableContent.css('width', totalColumnWidth);

		// ========================= CONSTRUCT DATA

		var plmodels = _.sortBy(rpt.plmodels(), function (d) {
			return parseInt(d.OrderIndex.replace(/PL/g, ''));
		});
		var exceptions = ["PL94C" /* "Operating Income" */, "PL39B" /* "Earning Before Tax" */, "PL41C" /* "Earning After Tax" */, "PL6A" /* "Discount" */];
		var netSalesPLCode = 'PL8A';
		var netSalesRow = {};
		var grossSalesPLCode = 'PL0';
		var grossSalesRow = {};
		var discountActivityPLCode = 'PL7A';
		var rows = [];

		rpt.fixRowValue(dataFlat);

		console.log("dataFlat", dataFlat);

		dataFlat.forEach(function (e) {
			var breakdown = e.key;
			netSalesRow[breakdown] = e[netSalesPLCode];
			grossSalesRow[breakdown] = e[grossSalesPLCode];
		});

		plmodels.forEach(function (d) {
			var row = { PNL: d.PLHeader3, PLCode: d._id, PNLTotal: 0, Percentage: 0 };
			dataFlat.forEach(function (e) {
				var breakdown = e.key;
				var value = e['' + d._id];
				row[breakdown] = value;

				if (toolkit.isDefined(e.excludeFromTotal)) {
					return;
				}

				row.PNLTotal += value;
			});
			dataFlat.forEach(function (e) {
				var breakdown = e.key;
				var percentage = toolkit.number(row[breakdown] / row.PNLTotal) * 100;
				percentage = toolkit.number(percentage);

				if (d._id == discountActivityPLCode) {
					percentage = toolkit.number(row[breakdown] / grossSalesRow[breakdown]) * 100;
				} else if (d._id != netSalesPLCode) {
					percentage = toolkit.number(row[breakdown] / netSalesRow[breakdown]) * 100;
				}

				if (percentage < 0) percentage = percentage * -1;

				row[breakdown + ' %'] = percentage;
			});

			if (exceptions.indexOf(row.PLCode) > -1) {
				return;
			}

			rows.push(row);
		});

		console.log("rows", rows);

		// === FIX TOTAL ===

		var FORBIDDEN_NUMBAH = ['PL31', 'PL30', 'PL29', 'PL28'];
		rows.forEach(function (r) {
			FORBIDDEN_NUMBAH.forEach(function (plf) {
				if (r.PLCode.indexOf(plf) > -1) {
					r['General Trade_Total'] -= r['General Trade_Regional Distributor'];
					r['General Trade_Total %'] -= r['General Trade_Regional Distributor %'];

					r['General Trade_Regional Distributor'] = 0;
					r['General Trade_Regional Distributor %'] = 0;
				}
			});
		});

		var grossSales = _.find(rows, function (r) {
			return r.PLCode == grossSalesPLCode;
		});
		var TotalNetSales = _.find(rows, function (r) {
			return r.PLCode == netSalesPLCode;
		}).PNLTotal;
		var TotalGrossSales = _.find(rows, function (r) {
			return r.PLCode == grossSalesPLCode;
		}).PNLTotal;
		rows.forEach(function (d, e) {
			var TotalPercentage = d.PNLTotal / TotalNetSales * 100;
			if (d.PLCode == discountActivityPLCode) {
				TotalPercentage = d.PNLTotal / TotalGrossSales * 100;

				// ====== hek MODERN TRADE numbah
				var grossSalesRedisMT = grossSales['Modern Trade_Regional Distributor'];
				var grossSalesRedisGT = grossSales['Modern Trade_Regional Distributor'];

				var discountBranchMTpercent = d['Modern Trade_Branch %'];
				var discountRedisMTCalculated = toolkit.valueXPercent(grossSalesRedisMT, discountBranchMTpercent);
				var discountRedisTotal = d['General Trade_Total'];
				var discountRedisGTCalculated = discountRedisTotal - discountRedisMTCalculated;
				var discountRedisGTPercentCalculated = toolkit.number(discountRedisGTCalculated / grossSalesRedisGT) * 100;

				d['Modern Trade_Regional Distributor'] = discountRedisMTCalculated;
				d['Modern Trade_Regional Distributor %'] = discountBranchMTpercent;

				d['General Trade_Regional Distributor'] = discountRedisGTCalculated;
				d['General Trade_Regional Distributor %'] = discountRedisGTPercentCalculated;
			}

			if (TotalPercentage < 0) TotalPercentage = TotalPercentage * -1;
			d.Percentage = toolkit.number(TotalPercentage);

			// ===== ABS %

			for (var p in d) {
				if (d.hasOwnProperty(p)) {
					if (p.indexOf('%') > -1 || p == "Percentage") {
						d[p] = Math.abs(d[p]);
					}
				}
			}
		});

		// ========================= PLOT DATA

		rows.forEach(function (d, i) {
			pnlTotalSum += d.PNLTotal;

			var PL = d.PLCode;
			PL = PL.replace(/\s+/g, '');
			var trHeader = toolkit.newEl('tr').addClass('header' + PL).attr('idheaderpl', PL).attr('data-row', 'row-' + i).appendTo(tableHeader).css('height', rpt.rowContentHeight() + 'px');

			trHeader.on('click', function () {
				v2.clickExpand(trHeader);
			});

			toolkit.newEl('td').html('<i></i>' + d.PNL).appendTo(trHeader);

			var pnlTotal = kendo.toString(d.PNLTotal, 'n0');
			toolkit.newEl('td').html(pnlTotal).addClass('align-right').appendTo(trHeader);

			toolkit.newEl('td').html(kendo.toString(d.Percentage, 'n2') + ' %').addClass('align-right').appendTo(trHeader);

			var trContent = toolkit.newEl('tr').addClass('column' + PL).attr('idpl', PL).attr('data-row', 'row-' + i).css('height', rpt.rowContentHeight() + 'px').appendTo(tableContent);

			dataFlat.forEach(function (e, f) {
				var key = e.key;
				var value = kendo.toString(d[key], 'n0');
				var percentage = kendo.toString(d[key + ' %'], 'n2') + ' %';

				if ($.trim(value) == '') {
					value = 0;
				}

				var cell = toolkit.newEl('td').html(value).addClass('align-right').appendTo(trContent);

				var cellPercentage = toolkit.newEl('td').html(percentage).addClass('align-right').appendTo(trContent);
			});

			var boolStatus = false;
			trContent.find('td').each(function (a, e) {
				if ($(e).text() != '0' && $(e).text() != '0.00 %') {
					boolStatus = true;
				}
			});

			if (boolStatus) {
				trContent.attr('statusval', 'show');
				trHeader.attr('statusval', 'show');
			} else {
				trContent.attr('statusval', 'hide');
				trHeader.attr('statusval', 'hide');
			}
		});

		// ========================= CONFIGURE THE HIRARCHY
		v2.buildGridLevels(container, rows);
	};

	v2.buildGridLevels = function (container, rows) {
		var grouppl1 = _.map(_.groupBy(rpt.plmodels(), function (d) {
			return d.PLHeader1;
		}), function (k, v) {
			return { data: k, key: v };
		});
		var grouppl2 = _.map(_.groupBy(rpt.plmodels(), function (d) {
			return d.PLHeader2;
		}), function (k, v) {
			return { data: k, key: v };
		});
		var grouppl3 = _.map(_.groupBy(rpt.plmodels(), function (d) {
			return d.PLHeader3;
		}), function (k, v) {
			return { data: k, key: v };
		});

		var $trElem = void 0,
		    $columnElem = void 0;
		var resg1 = void 0,
		    resg2 = void 0,
		    resg3 = void 0,
		    PLyo = void 0,
		    PLyo2 = void 0,
		    child = 0,
		    parenttr = 0,
		    textPL = void 0;
		container.find(".table-header tbody>tr").each(function (i) {
			if (i > 0) {
				$trElem = $(this);
				resg1 = _.find(grouppl1, function (o) {
					return o.key == $trElem.find('td:eq(0)').text();
				});
				resg2 = _.find(grouppl2, function (o) {
					return o.key == $trElem.find('td:eq(0)').text();
				});
				resg3 = _.find(grouppl3, function (o) {
					return o.key == $trElem.find('td:eq(0)').text();
				});

				var idplyo = _.find(rpt.idarrayhide(), function (a) {
					return a == $trElem.attr("idheaderpl");
				});
				if (idplyo != undefined) {
					$trElem.remove();
					container.find('.table-content tr.column' + $trElem.attr("idheaderpl")).remove();
				}
				if (resg1 == undefined && idplyo2 == undefined) {
					if (resg2 != undefined) {
						textPL = _.find(resg2.data, function (o) {
							return o._id == $trElem.attr("idheaderpl");
						});
						PLyo = _.find(rows, function (o) {
							return o.PNL == textPL.PLHeader1;
						});
						PLyo2 = _.find(rows, function (o) {
							return o.PLCode == textPL._id;
						});
						$trElem.find('td:eq(0)').css('padding-left', '40px');
						$trElem.attr('idparent', PLyo.PLCode);
						child = container.find('tr[idparent=' + PLyo.PLCode + ']').length;
						$columnElem = container.find('.table-content tr.column' + PLyo2.PLCode);
						$columnElem.attr('idcontparent', PLyo.PLCode);
						var PLCodeChange = rpt.changeParent($trElem, $columnElem, $columnElem.attr('idpl'));
						if (PLCodeChange != "") PLyo.PLCode = PLCodeChange;
						if (child > 1) {
							var $parenttr = container.find('tr[idheaderpl=' + PLyo.PLCode + ']');
							var $parenttrcontent = container.find('tr[idpl=' + PLyo.PLCode + ']');
							// $trElem.insertAfter($(`tr[idparent=${PLyo.PLCode}]:eq(${(child-1)})`))
							// $columnElem.insertAfter($(`tr[idcontparent=${PLyo.PLCode}]:eq(${(child-1)})`))
							$trElem.insertAfter($parenttr);
							$columnElem.insertAfter($parenttrcontent);
						} else {
							$trElem.insertAfter(container.find('tr.header' + PLyo.PLCode));
							$columnElem.insertAfter(container.find('tr.column' + PLyo.PLCode));
						}
					} else if (resg2 == undefined) {
						if (resg3 != undefined) {
							PLyo = _.find(rows, function (o) {
								return o.PNL == resg3.data[0].PLHeader2;
							});
							PLyo2 = _.find(rows, function (o) {
								return o.PNL == resg3.data[0].PLHeader3;
							});
							$trElem.find('td:eq(0)').css('padding-left', '70px');
							if (PLyo == undefined) {
								PLyo = _.find(rows, function (o) {
									return o.PNL == resg3.data[0].PLHeader1;
								});
								if (PLyo != undefined) $trElem.find('td:eq(0)').css('padding-left', '40px');
							}
							$trElem.attr('idparent', PLyo.PLCode);
							child = container.find('tr[idparent=' + PLyo.PLCode + ']').length;
							$columnElem = container.find('.table-content tr.column' + PLyo2.PLCode);
							$columnElem.attr('idcontparent', PLyo.PLCode);
							var _PLCodeChange = rpt.changeParent($trElem, $columnElem, $columnElem.attr('idpl'));
							if (_PLCodeChange != "") PLyo.PLCode = _PLCodeChange;
							if (child > 1) {
								var _$parenttr = container.find('tr[idheaderpl=' + PLyo.PLCode + ']');
								var _$parenttrcontent = container.find('tr[idpl=' + PLyo.PLCode + ']');
								// $trElem.insertAfter(container.find(`tr[idparent=${PLyo.PLCode}]:eq(${(child-1)})`))
								// $columnElem.insertAfter(container.find(`tr[idcontparent=${PLyo.PLCode}]:eq(${(child-1)})`))
								$trElem.insertAfter(_$parenttr);
								$columnElem.insertAfter(_$parenttrcontent);
							} else {
								$trElem.insertAfter(container.find('tr.header' + PLyo.PLCode));
								$columnElem.insertAfter(container.find('tr.column' + PLyo.PLCode));
							}
						}
					}
				}

				var idplyo2 = _.find(rpt.idarrayhide(), function (a) {
					return a == $trElem.attr("idparent");
				});
				if (idplyo2 != undefined) {
					$trElem.removeAttr('idparent');
					$trElem.addClass('bold');
					$trElem.css('display', 'inline-grid');
					container.find('.table-content tr.column' + $trElem.attr("idheaderpl")).removeAttr("idcontparent");
					container.find('.table-content tr.column' + $trElem.attr("idheaderpl")).attr('statusval', 'show');
					container.find('.table-content tr.column' + $trElem.attr("idheaderpl")).attr('statusvaltemp', 'show');
					container.find('.table-content tr.column' + $trElem.attr("idheaderpl")).css('display', 'inline-grid');
				}
			}
		});

		var countChild = '';
		container.find(".table-header tbody>tr").each(function (i) {
			$trElem = container.find(this);
			parenttr = container.find('tr[idparent=' + $trElem.attr('idheaderpl') + ']').length;
			if (parenttr > 0) {
				$trElem.addClass('dd');
				$trElem.find('td:eq(0)>i').addClass('fa fa-chevron-right').css('margin-right', '5px');
				container.find('tr[idparent=' + $trElem.attr('idheaderpl') + ']').css('display', 'none');
				container.find('tr[idcontparent=' + $trElem.attr('idheaderpl') + ']').css('display', 'none');
				container.find('tr[idparent=' + $trElem.attr('idheaderpl') + ']').each(function (a, e) {
					if (container.find(e).attr('statusval') == 'show') {
						container.find('tr[idheaderpl=' + $trElem.attr('idheaderpl') + ']').attr('statusval', 'show');
						container.find('tr[idpl=' + $trElem.attr('idheaderpl') + ']').attr('statusval', 'show');
						if (container.find('tr[idheaderpl=' + $trElem.attr('idheaderpl') + ']').attr('idparent') == undefined) {
							container.find('tr[idpl=' + $trElem.attr('idheaderpl') + ']').css('display', '');
							container.find('tr[idheaderpl=' + $trElem.attr('idheaderpl') + ']').css('display', '');
						}
					}
				});
			} else {
				countChild = $trElem.attr('idparent');
				if (countChild == '' || countChild == undefined) $trElem.find('td:eq(0)').css('padding-left', '20px');
			}
		});

		rpt.showZeroValue(false);
		container.find(".table-header tr:not([idparent]):not([idcontparent])").addClass('bold');
		rpt.refreshHeight();
		rpt.addScrollBottom(container);
	};
})();

viewModel.RDvsBranchView1 = {};
var v1 = viewModel.RDvsBranchView1;(function () {
	var colors = ['rgb(17, 134, 212)', 'rgb(32, 162, 87)', 'rgb(234, 144, 0)'];

	v1.contentIsLoading = ko.observable(false);
	v1.mode = ko.observable('branch');

	v1.breakdownBy = ko.observable('customer.channelname');
	v1.breakdownByFiscalYear = ko.observable('date.fiscal');

	v1.data = ko.observableArray([]);
	v1.fiscalYear = ko.observable(rpt.value.FiscalYear());
	v1.level = ko.observable(2);
	v1.title = ko.observable('Total Branch & RD');

	v1.changeTo = function (d, e) {
		v1.title(d);
		$(window).trigger('scroll');
	};

	v1.refresh = function () {
		var useCache = arguments.length <= 0 || arguments[0] === undefined ? false : arguments[0];

		$('.breakdown-view:not(.grid-breakdown-branch-rd)').empty();

		var param = {};
		param.pls = [];
		param.groups = rpt.parseGroups([v1.breakdownBy()]);
		param.aggr = 'sum';
		param.flag = 'branch-vs-rd';
		param.filters = rpt.getFilterValue(false, v1.fiscalYear);

		v1.contentIsLoading(true);

		var fetch = function fetch() {
			subchan.injectFilters(param.filters);
			toolkit.ajaxPost(viewModel.appName + "report/getpnldatanew", param, function (res) {
				if (res.Status == "NOK") {
					setTimeout(function () {
						fetch();
					}, 1000 * 5);
					return;
				}

				if (rpt.isEmptyData(res)) {
					v1.contentIsLoading(false);
					return;
				}

				v1.data(v1.buildStructure(res.Data.Data));
				rpt.plmodels(res.Data.PLModels);
				v1.emptyGrid();
				v1.contentIsLoading(false);
				v1.render();
				rpt.prepareEvents();
			}, function () {
				v1.emptyGrid();
				v1.contentIsLoading(false);
			});
		};

		fetch();
	};

	v1.clickExpand = function (e) {
		var right = $(e).find('i.fa-chevron-right').length;
		var down = $(e).find('i.fa-chevron-down').length;
		if (right > 0) {
			if (['PL28', 'PL29A', 'PL31'].indexOf($(e).attr('idheaderpl')) > -1) {
				$('.pivot-pnl .table-header').css('width', rpt.pnlTableHeaderWidth());
				$('.pivot-pnl .table-content').css('margin-left', rpt.pnlTableHeaderWidth());
			}

			$(e).find('i').removeClass('fa-chevron-right');
			$(e).find('i').addClass('fa-chevron-down');
			$('tr[idparent=' + e.attr('idheaderpl') + ']').css('display', '');
			$('tr[idcontparent=' + e.attr('idheaderpl') + ']').css('display', '');
			$('tr[statusvaltemp=hide]').css('display', 'none');
			rpt.refreshHeight(e.attr('idheaderpl'));
		}
		if (down > 0) {
			if (['PL28', 'PL29A', 'PL31'].indexOf($(e).attr('idheaderpl')) > -1) {
				$('.pivot-pnl .table-header').css('width', '');
				$('.pivot-pnl .table-content').css('margin-left', '');
			}

			$(e).find('i').removeClass('fa-chevron-down');
			$(e).find('i').addClass('fa-chevron-right');
			$('tr[idparent=' + e.attr('idheaderpl') + ']').css('display', 'none');
			$('tr[idcontparent=' + e.attr('idheaderpl') + ']').css('display', 'none');
			rpt.hideAllChild(e.attr('idheaderpl'));
		}
	};

	v1.emptyGrid = function () {
		$('.grid-breakdown-branch-rd').replaceWith('<div class="breakdown-view ez grid-breakdown-branch-rd"></div>');
	};

	v1.buildStructure = function (data) {
		var groupThenMap = function groupThenMap(data, group) {
			var op1 = _.groupBy(data, function (d) {
				return group(d);
			});
			var op2 = _.map(op1, function (v, k) {
				var key = { _id: k, subs: v };
				var sample = v[0];

				var _loop5 = function _loop5(prop) {
					if (sample.hasOwnProperty(prop) && prop != '_id') {
						key[prop] = toolkit.sum(v, function (d) {
							return d[prop];
						});
					}
				};

				for (var prop in sample) {
					_loop5(prop);
				}

				return key;
			});

			return op2;
		};

		var parsed = groupThenMap(data, function (d) {
			return d._id._id_branchrd;
		}).map(function (d) {
			var subs = groupThenMap(d.subs, function (e) {
				return e._id._id_customer_channelname;
			}).map(function (e) {
				e.breakdowns = e.subs[0]._id;
				d.count = 1;
				return e;
			});

			d.subs = _.orderBy(subs, function (e) {
				return e.PL8A;
			}, 'desc');
			d.breakdowns = d.subs[0]._id;
			d.count = d.subs.length;

			var total = {};
			total._id = 'Total';
			total.key = 'Total';
			total.excludeFromTotal = true;

			var _loop6 = function _loop6(prop) {
				if (subs[0].hasOwnProperty(prop) && prop.search('PL') > -1) {
					var val = subs[0][prop];
					total[prop] = toolkit.sum(subs, function (f) {
						return f[prop];
					});
				}
			};

			for (var prop in subs[0]) {
				_loop6(prop);
			}d.subs = [total].concat(d.subs);
			// d.count++

			return d;
		});

		v1.level(2);
		var newParsed = _.orderBy(parsed, function (d) {
			return d.PL8A;
		}, 'desc');
		return newParsed;
	};

	v1.render = function () {
		var container = $('.grid-breakdown-branch-rd');
		if (v1.data().length == 0) {
			container.html('No data found.');
			return;
		}

		// ========================= TABLE STRUCTURE

		var percentageWidth = 100;

		var wrapper = toolkit.newEl('div').addClass('pivot-pnl-branch pivot-pnl').appendTo(container);

		var tableHeaderWrap = toolkit.newEl('div').addClass('table-header').appendTo(wrapper);

		var tableHeader = toolkit.newEl('table').addClass('table').appendTo(tableHeaderWrap);

		var tableContentWrap = toolkit.newEl('div').appendTo(wrapper).addClass('table-content');

		var tableContent = toolkit.newEl('table').addClass('table').appendTo(tableContentWrap);

		var trHeader = toolkit.newEl('tr').appendTo(tableHeader);

		toolkit.newEl('th').html('P&L').css('height', rpt.rowHeaderHeight() * v1.level() + 'px').attr('data-rowspan', v1.level()).css('vertical-align', 'middle').addClass('cell-percentage-header').appendTo(trHeader);

		toolkit.newEl('th').html('Total').css('height', rpt.rowHeaderHeight() * v1.level() + 'px').attr('data-rowspan', v1.level()).css('vertical-align', 'middle').addClass('cell-percentage-header align-right').appendTo(trHeader);

		toolkit.newEl('th').html('% of N Sales').css('height', rpt.rowHeaderHeight() * v1.level() + 'px').css('vertical-align', 'middle').css('font-weight', 'normal').css('font-style', 'italic').width(percentageWidth - 20).attr('data-rowspan', v1.level()).css('vertical-align', 'middle').appendTo(trHeader);

		var trContents = [];
		for (var i = 0; i < v1.level(); i++) {
			trContents.push(toolkit.newEl('tr').appendTo(tableContent).css('height', rpt.rowHeaderHeight() + 'px'));
		}

		// ========================= BUILD HEADER

		var data = v1.data();

		var columnWidth = 140;
		var totalColumnWidth = 0;
		var pnlTotalSum = 0;
		var dataFlat = [];

		var countWidthThenPush = function countWidthThenPush(thheader, each, key) {
			var currentColumnWidth = columnWidth;

			each.key = key.join('_');
			dataFlat.push(each);

			totalColumnWidth += currentColumnWidth;
			thheader.width(currentColumnWidth);
		};

		data.filter(function (d) {
			return d._id != v1.mode();
		}).forEach(function (lvl1, i) {
			lvl1.subs.forEach(function (lvl2, j) {
				var each = lvl2;
				var key = [lvl1._id, lvl2._id];

				each.key = key.join('_');
				dataFlat.push(each);
			});
		});

		data.filter(function (d) {
			return d._id == v1.mode();
		}).forEach(function (lvl1, i) {
			var thheader1 = toolkit.newEl('th').html(lvl1._id).attr('colspan', lvl1.count).addClass('align-center').appendTo(trContents[0]).css('border-top', 'none');

			if (v1.level() == 1) {
				countWidthThenPush(thheader1, lvl1, [lvl1._id]);

				totalColumnWidth += percentageWidth;
				var thheader1p = toolkit.newEl('th').html('% of N Sales').css('font-weight', 'normal').css('font-style', 'italic').width(percentageWidth).addClass('align-center').appendTo(trContents[0]).css('border-top', 'none');

				return;
			}
			thheader1.attr('colspan', lvl1.count * 2);

			lvl1.subs.forEach(function (lvl2, j) {
				var thheader2 = toolkit.newEl('th').html(lvl2._id).addClass('align-center');

				if (lvl2._id != 'Total') {
					thheader2.appendTo(trContents[1]);
				}

				if (v1.level() == 2) {
					countWidthThenPush(thheader2, lvl2, [lvl1._id, lvl2._id]);

					totalColumnWidth += percentageWidth;
					var _thheader1p3 = toolkit.newEl('th').html('% of N Sales').css('font-weight', 'normal').css('font-style', 'italic').width(percentageWidth).addClass('align-center');

					if (lvl2._id != 'Total') {
						_thheader1p3.appendTo(trContents[1]);
					}

					return;
				}
				thheader2.attr('colspan', lvl2.count);
			});
		});

		tableContent.css('min-width', totalColumnWidth);

		// ========================= CONSTRUCT DATA

		var plmodels = _.sortBy(rpt.plmodels(), function (d) {
			return parseInt(d.OrderIndex.replace(/PL/g, ''));
		});
		var exceptions = ["PL94C" /* "Operating Income" */, "PL39B" /* "Earning Before Tax" */, "PL41C" /* "Earning After Tax" */, "PL6A" /* "Discount" */];
		var netSalesPLCode = 'PL8A';
		var netSalesRow = {};
		var grossSalesPLCode = 'PL0';
		var grossSalesRow = {};
		var discountActivityPLCode = 'PL7A';
		var rows = [];

		rpt.fixRowValue(dataFlat);

		console.log("dataFlat", dataFlat);

		dataFlat.forEach(function (e) {
			var breakdown = e.key;
			netSalesRow[breakdown] = e[netSalesPLCode];
			grossSalesRow[breakdown] = e[grossSalesPLCode];
		});

		plmodels.forEach(function (d) {
			var row = { PNL: d.PLHeader3, PLCode: d._id, PNLTotal: 0, Percentage: 0 };
			dataFlat.forEach(function (e) {
				var breakdown = e.key;
				var value = e['' + d._id];
				row[breakdown] = value;

				if (toolkit.isDefined(e.excludeFromTotal)) {
					return;
				}

				row.PNLTotal += value;
			});
			dataFlat.forEach(function (e) {
				var breakdown = e.key;
				var percentage = toolkit.number(row[breakdown] / row.PNLTotal) * 100;
				percentage = toolkit.number(percentage);

				if (d._id == discountActivityPLCode) {
					percentage = toolkit.number(row[breakdown] / grossSalesRow[breakdown]) * 100;
				} else if (d._id != netSalesPLCode) {
					percentage = toolkit.number(row[breakdown] / netSalesRow[breakdown]) * 100;
				}

				row[breakdown + ' %'] = percentage;
			});

			if (exceptions.indexOf(row.PLCode) > -1) {
				return;
			}

			rows.push(row);
		});

		console.log("rows", rows);

		// === FIX TOTAL ===

		var FORBIDDEN_NUMBAH = ['PL31', 'PL30', 'PL29', 'PL28'];
		rows.forEach(function (r) {
			FORBIDDEN_NUMBAH.forEach(function (plf) {
				if (r.PLCode.indexOf(plf) > -1) {
					r['Regional Distributor_Total'] -= r['Regional Distributor_General Trade'];
					r['Regional Distributor_Total %'] -= r['Regional Distributor_General Trade %'];

					r['Regional Distributor_General Trade'] = 0;
					r['Regional Distributor_General Trade %'] = 0;
				}
			});
		});

		rows.forEach(function (d) {
			d.PNLTotal = 0;

			for (var p in d) {
				if (d.hasOwnProperty(p) && p.split('_')[0] == v1.mode() && p.toLowerCase().indexOf('total') == -1) {
					d.PNLTotal += d[p];
				}
			}
		});

		var grossSales = _.find(rows, function (r) {
			return r.PLCode == grossSalesPLCode;
		});
		var TotalNetSales = _.find(rows, function (r) {
			return r.PLCode == netSalesPLCode;
		}).PNLTotal;
		var TotalGrossSales = _.find(rows, function (r) {
			return r.PLCode == grossSalesPLCode;
		}).PNLTotal;
		rows.forEach(function (d, e) {
			var TotalPercentage = d.PNLTotal / TotalNetSales * 100;
			if (d.PLCode == discountActivityPLCode) {
				TotalPercentage = d.PNLTotal / TotalGrossSales * 100;

				// ====== hek MODERN TRADE numbah
				var grossSalesRedisMT = grossSales['Regional Distributor_Modern Trade'];
				var grossSalesRedisGT = grossSales['Regional Distributor_Modern Trade'];

				var discountBranchMTpercent = d['Branch_Modern Trade %'];
				var discountRedisMTCalculated = toolkit.valueXPercent(grossSalesRedisMT, discountBranchMTpercent);
				var discountRedisTotal = d['Regional Distributor_Total'];
				var discountRedisGTCalculated = discountRedisTotal - discountRedisMTCalculated;
				var discountRedisGTPercentCalculated = toolkit.number(discountRedisGTCalculated / grossSalesRedisGT) * 100;

				d['Regional Distributor_Modern Trade'] = discountRedisMTCalculated;
				d['Regional Distributor_Modern Trade %'] = discountBranchMTpercent;

				d['Regional Distributor_General Trade'] = discountRedisGTCalculated;
				d['Regional Distributor_General Trade %'] = discountRedisGTPercentCalculated;
			}

			if (TotalPercentage < 0) TotalPercentage = TotalPercentage * -1;
			d.Percentage = toolkit.number(TotalPercentage);

			// ===== ABS %

			for (var p in d) {
				if (d.hasOwnProperty(p)) {
					if (p.indexOf('%') > -1 || p == "Percentage") {
						d[p] = Math.abs(d[p]);
					}
				}
			}
		});

		// ========================= PLOT DATA

		rows.forEach(function (d, i) {
			pnlTotalSum += d.PNLTotal;

			var PL = d.PLCode;
			PL = PL.replace(/\s+/g, '');
			var trHeader = toolkit.newEl('tr').addClass('header' + PL).attr('idheaderpl', PL).attr('data-row', 'row-' + i).css('height', rpt.rowContentHeight() + 'px').appendTo(tableHeader);

			trHeader.on('click', function () {
				v1.clickExpand(trHeader);
			});

			toolkit.newEl('td').html('<i></i>' + d.PNL).appendTo(trHeader);

			var pnlTotal = kendo.toString(d.PNLTotal, 'n0');
			toolkit.newEl('td').html(pnlTotal).addClass('align-right').appendTo(trHeader);

			toolkit.newEl('td').html(kendo.toString(d.Percentage, 'n2') + ' %').addClass('align-right').appendTo(trHeader);

			var trContent = toolkit.newEl('tr').addClass('column' + PL).attr('idpl', PL).attr('data-row', 'row-' + i).css('height', rpt.rowContentHeight() + 'px').appendTo(tableContent);

			dataFlat.filter(function (g) {
				return g.key.split('_')[0] == v1.mode();
			}).forEach(function (e, f) {
				if (e._id == 'Total') {
					return;
				}

				var key = e.key;
				var value = kendo.toString(d[key], 'n0');
				var percentage = kendo.toString(d[key + ' %'], 'n2') + ' %';

				if ($.trim(value) == '') {
					value = 0;
				}

				var cell = toolkit.newEl('td').html(value).addClass('align-right').appendTo(trContent);

				var cellPercentage = toolkit.newEl('td').html(percentage).addClass('align-right').appendTo(trContent);
			});

			var boolStatus = false;
			trContent.find('td').each(function (a, e) {
				if ($(e).text() != '0' && $(e).text() != '0.00 %') {
					boolStatus = true;
				}
			});

			if (boolStatus) {
				trContent.attr('statusval', 'show');
				trHeader.attr('statusval', 'show');
			} else {
				trContent.attr('statusval', 'hide');
				trHeader.attr('statusval', 'hide');
			}
		});

		// ========================= CONFIGURE THE HIRARCHY

		v2.buildGridLevels(container, rows);
	};
})();

viewModel.keyAccount = new Object();
var kac = viewModel.keyAccount;(function () {
	kac.contentIsLoading = ko.observable(false);
	kac.popupIsLoading = ko.observable(false);
	kac.title = ko.observable('Key Account Analysis');
	kac.detail = ko.observableArray([]);
	kac.limit = ko.observable(10);
	kac.breakdownNote = ko.observable('');

	kac.breakdownBy = ko.observable('customer.customergroupname');
	kac.breakdownByFiscalYear = ko.observable('date.fiscal');
	kac.oldBreakdownBy = ko.observable(kac.breakdownBy());

	kac.data = ko.observableArray([]);
	kac.fiscalYear = ko.observable(rpt.value.FiscalYear());
	kac.breakdownValue = ko.observableArray([]);
	kac.breakdownGroupValue = ko.observableArray([]);

	kac.refresh = function () {
		var useCache = arguments.length <= 0 || arguments[0] === undefined ? false : arguments[0];

		$('.breakdown-view:not(#key-account-analysis)').empty();

		if (kac.breakdownValue().length == 0) {
			toolkit.showError('Please choose at least breakdown value');
			return;
		}

		var breakdownKeyAccount = 'customer.keyaccount';
		var param = {};
		param.pls = [];
		param.groups = rpt.parseGroups([kac.breakdownBy(), breakdownKeyAccount]);
		param.aggr = 'sum';
		param.filters = rpt.getFilterValue(false, kac.fiscalYear);

		var breakdownGroupValue = kac.breakdownGroupValue().filter(function (d) {
			return d != 'All';
		});
		if (breakdownGroupValue.length > 0) {
			param.filters.push({
				Field: breakdownKeyAccount,
				Op: '$in',
				Value: kac.breakdownGroupValue()
			});
		}

		var breakdownValue = kac.breakdownValue().filter(function (d) {
			return d != 'All';
		});
		if (breakdownValue.length > 0) {
			param.filters.push({
				Field: kac.breakdownBy(),
				Op: '$in',
				Value: kac.breakdownValue()
			});
		}
		console.log("bdk", param.filters);

		kac.oldBreakdownBy(kac.breakdownBy());
		kac.contentIsLoading(true);

		var fetch = function fetch() {
			subchan.injectFilters(param.filters);
			toolkit.ajaxPost(viewModel.appName + "report/getpnldatanew", param, function (res) {
				if (res.Status == "NOK") {
					setTimeout(function () {
						fetch();
					}, 1000 * 5);
					return;
				}

				if (rpt.isEmptyData(res)) {
					kac.contentIsLoading(false);
					return;
				}

				var date = moment(res.time).format("dddd, DD MMMM YYYY HH:mm:ss");
				kac.breakdownNote('Last refreshed on: ' + date);

				kac.data(res.Data.Data);
				rpt.plmodels(res.Data.PLModels);
				kac.emptyGrid();
				kac.contentIsLoading(false);
				kac.render();
				rpt.prepareEvents();
			}, function () {
				kac.emptyGrid();
				kac.contentIsLoading(false);
			}, {
				cache: useCache == true ? 'breakdown chart' : false
			});
		};

		fetch();
	};

	kac.clickExpand = function (e) {
		var right = $(e).find('i.fa-chevron-right').length;
		var down = $(e).find('i.fa-chevron-down').length;
		if (right > 0) {
			if (['PL28', 'PL29A', 'PL31'].indexOf($(e).attr('idheaderpl')) > -1) {
				$('.pivot-pnl .table-header').css('width', rpt.pnlTableHeaderWidth());
				$('.pivot-pnl .table-content').css('margin-left', rpt.pnlTableHeaderWidth());
			}

			$(e).find('i').removeClass('fa-chevron-right');
			$(e).find('i').addClass('fa-chevron-down');
			$('tr[idparent=' + e.attr('idheaderpl') + ']').css('display', '');
			$('tr[idcontparent=' + e.attr('idheaderpl') + ']').css('display', '');
			$('tr[statusvaltemp=hide]').css('display', 'none');
		}
		if (down > 0) {
			if (['PL28', 'PL29A', 'PL31'].indexOf($(e).attr('idheaderpl')) > -1) {
				$('.pivot-pnl .table-header').css('width', '');
				$('.pivot-pnl .table-content').css('margin-left', '');
			}

			$(e).find('i').removeClass('fa-chevron-down');
			$(e).find('i').addClass('fa-chevron-right');
			$('tr[idparent=' + e.attr('idheaderpl') + ']').css('display', 'none');
			$('tr[idcontparent=' + e.attr('idheaderpl') + ']').css('display', 'none');
			rpt.hideAllChild(e.attr('idheaderpl'));
		}
	};
	kac.emptyGrid = function () {
		$('#key-account-analysis').replaceWith('<div class="breakdown-view ez" id="key-account-analysis"></div>');
	};

	kac.render = function () {
		if (kac.data().length == 0) {
			$('#key-account-analysis').html('No data found.');
			return;
		}

		var breakdowns = [kac.breakdownBy() /** , 'date.year' */];
		var rows = [];

		var data = _.map(kac.data(), function (d) {
			d.breakdowns = {};
			var titleParts = [];

			breakdowns.forEach(function (e) {
				var title = d._id['_id_' + toolkit.replace(e, '.', '_')];
				title = toolkit.whenEmptyString(title, '');
				d.breakdowns[e] = title;
				titleParts.push(title);
			});

			d._id = titleParts.join(' ');
			return d;
		});

		var plmodels = _.sortBy(rpt.plmodels(), function (d) {
			return parseInt(d.OrderIndex.replace(/PL/g, ''));
		});
		var exceptions = ["PL94C" /* "Operating Income" */, "PL39B" /* "Earning Before Tax" */, "PL41C" /* "Earning After Tax" */, "PL6A" /* "Discount" */];
		var netSalesPLCode = 'PL8A';
		var netSalesRow = {};
		var grossSalesPLCode = 'PL0';
		var grossSalesRow = {};
		var discountActivityPLCode = 'PL7A';

		rpt.fixRowValue(data);

		data.forEach(function (e) {
			var breakdown = e._id;
			netSalesRow[breakdown] = e[netSalesPLCode];
			grossSalesRow[breakdown] = e[grossSalesPLCode];
		});
		data = _.orderBy(data, function (d) {
			return netSalesRow[d._id];
		}, 'desc');

		plmodels.forEach(function (d) {
			var row = { PNL: d.PLHeader3, PLCode: d._id, PNLTotal: 0, Percentage: 0 };
			data.forEach(function (e) {
				var breakdown = e._id;
				var value = e['' + d._id];
				value = toolkit.number(value);
				row[breakdown] = value;
				row.PNLTotal += value;
			});
			data.forEach(function (e) {
				var breakdown = e._id;
				var percentage = toolkit.number(e['' + d._id] / row.PNLTotal) * 100;
				percentage = toolkit.number(percentage);

				if (d._id == discountActivityPLCode) {
					percentage = toolkit.number(row[breakdown] / grossSalesRow[breakdown]) * 100;
				} else if (d._id != netSalesPLCode) {
					percentage = toolkit.number(row[breakdown] / netSalesRow[breakdown]) * 100;
				}

				if (percentage < 0) percentage = percentage * -1;

				row[breakdown + ' %'] = percentage;
			});

			if (exceptions.indexOf(row.PLCode) > -1) {
				return;
			}

			rows.push(row);
		});

		var TotalNetSales = _.find(rows, function (r) {
			return r.PLCode == netSalesPLCode;
		}).PNLTotal;
		var TotalGrossSales = _.find(rows, function (r) {
			return r.PLCode == grossSalesPLCode;
		}).PNLTotal;
		rows.forEach(function (d, e) {
			var TotalPercentage = d.PNLTotal / TotalNetSales * 100;
			if (d.PLCode == discountActivityPLCode) {
				TotalPercentage = d.PNLTotal / TotalGrossSales * 100;
			}

			if (TotalPercentage < 0) TotalPercentage = TotalPercentage * -1;
			rows[e].Percentage = toolkit.number(TotalPercentage);
		});

		var percentageWidth = 100;

		var wrapper = toolkit.newEl('div').addClass('pivot-pnl').appendTo($('#key-account-analysis'));

		var tableHeaderWrap = toolkit.newEl('div').addClass('table-header').appendTo(wrapper);

		var tableHeader = toolkit.newEl('table').addClass('table').appendTo(tableHeaderWrap);

		var tableContentWrap = toolkit.newEl('div').appendTo(wrapper).addClass('table-content');

		var tableContent = toolkit.newEl('table').addClass('table').appendTo(tableContentWrap);

		var trHeader1 = toolkit.newEl('tr').appendTo(tableHeader);

		toolkit.newEl('th').html('P&L').css('height', rpt.rowHeaderHeight() + 'px').appendTo(trHeader1);

		toolkit.newEl('th').html('Total').css('height', rpt.rowHeaderHeight() + 'px').addClass('align-right').appendTo(trHeader1);

		toolkit.newEl('th').html('% of N Sales').css('height', rpt.rowHeaderHeight() + 'px').css('font-weight', 'normal').css('font-style', 'italic').width(percentageWidth - 20).addClass('align-right').appendTo(trHeader1);

		var trContent1 = toolkit.newEl('tr').appendTo(tableContent);

		var colWidth = 160;
		var totalWidth = 0;
		var pnlTotalSum = 0;

		if (kac.breakdownBy() == "customer.branchname") {
			colWidth = 200;
		}

		if (kac.breakdownBy() == "customer.region") {
			colWidth = 230;
		}

		data.forEach(function (d, i) {
			if (d._id.length > 22) colWidth += 30;
			toolkit.newEl('th').html(d._id).addClass('align-right').appendTo(trContent1).width(colWidth);

			toolkit.newEl('th').html('% of N Sales').css('font-weight', 'normal').css('font-style', 'italic').width(percentageWidth).addClass('align-right cell-percentage').appendTo(trContent1).width(percentageWidth);

			totalWidth += colWidth + percentageWidth;
		});
		// console.log('data ', data)

		tableContent.css('min-width', totalWidth);

		// console.log('row ', rows)
		rows.forEach(function (d, i) {
			pnlTotalSum += d.PNLTotal;

			var PL = d.PLCode;
			PL = PL.replace(/\s+/g, '');
			var trHeader = toolkit.newEl('tr').addClass('header' + PL).attr('idheaderpl', PL).attr('data-row', 'row-' + i).appendTo(tableHeader).css('height', rpt.rowContentHeight() + 'px');

			trHeader.on('click', function () {
				kac.clickExpand(trHeader);
			});

			toolkit.newEl('td').html('<i></i>' + d.PNL).appendTo(trHeader);

			var pnlTotal = kendo.toString(d.PNLTotal, 'n0');
			toolkit.newEl('td').html(pnlTotal).addClass('align-right').appendTo(trHeader);

			toolkit.newEl('td').html(kendo.toString(d.Percentage, 'n2') + '%').addClass('align-right').appendTo(trHeader);

			var trContent = toolkit.newEl('tr').addClass('column' + PL).attr('data-row', 'row-' + i).attr('idpl', PL).css('height', rpt.rowContentHeight() + 'px').appendTo(tableContent);

			data.forEach(function (e, f) {
				var key = e._id;
				var value = kendo.toString(d[key], 'n0');

				var percentage = kendo.toString(d[key + ' %'], 'n2');

				if ($.trim(value) == '') {
					value = 0;
				}

				var cell = toolkit.newEl('td').html(value).addClass('align-right').appendTo(trContent);

				cell.on('click', function () {
					kac.renderDetail(d.PLCode, e.breakdowns);
				});

				toolkit.newEl('td').html(percentage + ' %').addClass('align-right cell-percentage').appendTo(trContent);
			});

			var boolStatus = false;
			trContent.find('td').each(function (a, e) {
				// console.log(trHeader.find('td:eq(0)').text(),$(e).text())
				if ($(e).text() != '0' && $(e).text() != '0.00 %') {
					boolStatus = true;
				}
			});
			if (boolStatus) {
				trContent.attr('statusval', 'show');
				trHeader.attr('statusval', 'show');
			} else {
				trContent.attr('statusval', 'hide');
				trHeader.attr('statusval', 'hide');
			}
		});

		rpt.buildGridLevels(rows);
	};

	kac.optionBreakdownValues = ko.observableArray([]);
	kac.breakdownValueAll = { _id: 'All', Name: 'All' };
	kac.changeBreakdown = function () {
		var all = kac.breakdownValueAll;
		setTimeout(function () {
			kac.optionBreakdownValues([all].concat(rpt.masterData.CustomerGroup().map(function (d) {
				return { _id: d.Name, Name: d.Name };
			})));
			kac.breakdownValue([all._id]);
		}, 100);
	};
	kac.changeBreakdownValue = function () {
		var all = kac.breakdownValueAll;
		setTimeout(function () {
			var condA1 = kac.breakdownValue().length == 2;
			var condA2 = kac.breakdownValue().indexOf(all._id) == 0;
			if (condA1 && condA2) {
				kac.breakdownValue.remove(all._id);
				return;
			}

			var condB1 = kac.breakdownValue().length > 1;
			var condB2 = kac.breakdownValue().reverse()[0] == all._id;
			if (condB1 && condB2) {
				kac.breakdownValue([all._id]);
				return;
			}

			var condC1 = kac.breakdownValue().length == 0;
			if (condC1) {
				kac.breakdownValue([all._id]);
			}
		}, 100);
	};

	kac.optionBreakdownGroupValues = ko.observableArray([]);
	kac.changeBreakdownGroup = function () {
		var all = kac.breakdownValueAll;
		setTimeout(function () {
			kac.optionBreakdownGroupValues([all].concat(rpt.masterData.KeyAccount().map(function (d) {
				var name = '(' + d._id + ') ' + d.Name;
				if (d.Name == 'OTHER') {
					name = d.Name;
				}

				return { _id: d._id, Name: name };
			})));
			kac.breakdownGroupValue([all._id]);
		}, 100);
	};
	kac.changeBreakdownGroupValue = function () {
		var all = kac.breakdownValueAll;
		setTimeout(function () {
			var condA1 = kac.breakdownGroupValue().length == 2;
			var condA2 = kac.breakdownGroupValue().indexOf(all._id) == 0;
			if (condA1 && condA2) {
				kac.breakdownGroupValue.remove(all._id);
				return;
			}

			var condB1 = kac.breakdownGroupValue().length > 1;
			var condB2 = kac.breakdownGroupValue().reverse()[0] == all._id;
			if (condB1 && condB2) {
				kac.breakdownGroupValue([all._id]);
				return;
			}

			var condC1 = kac.breakdownGroupValue().length == 0;
			if (condC1) {
				kac.breakdownGroupValue([all._id]);
			}
		}, 100);
	};
})();

viewModel.subChannel = {};
var subchan = viewModel.subChannel;(function () {
	subchan.contentIsLoading = ko.observable(false);
	subchan.popupIsLoading = ko.observable(false);
	subchan.title = ko.observable('P&L Analytic');
	subchan.detail = ko.observableArray([]);
	subchan.limit = ko.observable(10);
	subchan.breakdownNote = ko.observable('');

	subchan.breakdownBy = ko.observable('');
	subchan.breakdownByFiscalYear = ko.observable('date.fiscal');
	subchan.oldBreakdownBy = ko.observable(subchan.breakdownBy());

	subchan.data = ko.observableArray([]);
	subchan.fiscalYear = ko.observable(rpt.value.FiscalYear());
	subchan.breakdownValue = ko.observableArray([]);
	subchan.level = ko.observable(1);
	subchan.what = ko.observable('mt sub channel');
	subchan.isInlineFilter = ko.observable(true);

	subchan.switchRefresh = function (title, what) {
		bkd.title(title);
		subchan.what(what);
		subchan.refresh();
	};

	subchan.refresh = function () {
		var useCache = arguments.length <= 0 || arguments[0] === undefined ? false : arguments[0];

		subchan.isInlineFilter(true);

		var param = {};
		param.pls = [];
		param.aggr = 'sum';
		param.filters = rpt.getFilterValue(false, subchan.fiscalYear);
		var groups = [];

		if (subchan.what() == 'mt sub channel') {
			subchan.breakdownBy('customer.reportsubchannel');
			subchan.breakdownValue(['I3']);
			groups.push(subchan.breakdownBy());

			param.filters.push({
				Field: 'customer.channelname',
				Op: '$in',
				Value: subchan.breakdownValue()
			});
		} else if (subchan.what() == 'account') {
			subchan.breakdownBy('customer.keyaccount');
			groups.push(subchan.breakdownBy());
		} else if (subchan.what() == 'brand') {
			subchan.isInlineFilter(false);
			subchan.breakdownBy('product.brand');
			groups.push(subchan.breakdownBy());

			var breakdownBrand = subchan.breakdownBrand().filter(function (d) {
				return d != 'All';
			});
			if (breakdownBrand.length > 0) {
				param.filters.push({
					Field: subchan.breakdownBy(),
					Op: '$in',
					Value: breakdownBrand
				});
			}
		} else if (subchan.what() == 'rd') {
			subchan.isInlineFilter(false);
			subchan.breakdownBy('customer.reportsubchannel');
			groups.push(subchan.breakdownBy());

			var breakdownChannel = 'customer.channelname';
			groups.push(breakdownChannel);
			param.filters.push({
				Field: breakdownChannel,
				Op: '$in',
				Value: ['I1']
			});

			var breakdownDistributor = subchan.breakdownDistributor().filter(function (d) {
				return d != 'All';
			});
			if (breakdownDistributor.length > 0) {
				param.filters.push({
					Field: subchan.breakdownBy(),
					Op: '$in',
					Value: breakdownDistributor
				});
			}
		}

		$('.breakdown-view:not(#subchan)').empty();

		param.groups = rpt.parseGroups(groups);
		subchan.contentIsLoading(true);

		var fetch = function fetch() {
			subchan.injectFilters(param.filters);
			toolkit.ajaxPost(viewModel.appName + "report/getpnldatanew", param, function (res) {
				if (res.Status == "NOK") {
					setTimeout(function () {
						fetch();
					}, 1000 * 5);
					return;
				}

				if (rpt.isEmptyData(res)) {
					subchan.contentIsLoading(false);
					return;
				}

				var data = subchan.buildStructure(res.Data.Data);
				subchan.data(data);
				rpt.plmodels(res.Data.PLModels);
				subchan.emptyGrid();
				subchan.contentIsLoading(false);
				subchan.render();
				rpt.prepareEvents();
			}, function () {
				subchan.emptyGrid();
				subchan.contentIsLoading(false);
			});
		};

		fetch();
	};

	subchan.clickExpand = function (e) {
		var right = $(e).find('i.fa-chevron-right').length;
		var down = $(e).find('i.fa-chevron-down').length;
		if (right > 0) {
			if (['PL28', 'PL29A', 'PL31'].indexOf($(e).attr('idheaderpl')) > -1) {
				$('.pivot-pnl .table-header').css('width', rpt.pnlTableHeaderWidth());
				$('.pivot-pnl .table-content').css('margin-left', rpt.pnlTableHeaderWidth());
			}

			$(e).find('i').removeClass('fa-chevron-right');
			$(e).find('i').addClass('fa-chevron-down');
			$('tr[idparent=' + e.attr('idheaderpl') + ']').css('display', '');
			$('tr[idcontparent=' + e.attr('idheaderpl') + ']').css('display', '');
			$('tr[statusvaltemp=hide]').css('display', 'none');
			rpt.refreshHeight(e.attr('idheaderpl'));
		}
		if (down > 0) {
			if (['PL28', 'PL29A', 'PL31'].indexOf($(e).attr('idheaderpl')) > -1) {
				$('.pivot-pnl .table-header').css('width', '');
				$('.pivot-pnl .table-content').css('margin-left', '');
			}

			$(e).find('i').removeClass('fa-chevron-down');
			$(e).find('i').addClass('fa-chevron-right');
			$('tr[idparent=' + e.attr('idheaderpl') + ']').css('display', 'none');
			$('tr[idcontparent=' + e.attr('idheaderpl') + ']').css('display', 'none');
			rpt.hideAllChild(e.attr('idheaderpl'));
		}
	};

	subchan.emptyGrid = function () {
		$('#subchan').replaceWith('<div class="breakdown-view ez" id="subchan"></div>');
	};

	subchan.buildStructure = function (data) {
		var groupThenMap = function groupThenMap(data, group) {
			var op1 = _.groupBy(data, function (d) {
				return group(d);
			});
			var op2 = _.map(op1, function (v, k) {
				var key = { _id: k, subs: v };
				var sample = v[0];

				var _loop7 = function _loop7(prop) {
					if (sample.hasOwnProperty(prop) && prop != '_id') {
						key[prop] = toolkit.sum(v, function (d) {
							return d[prop];
						});
					}
				};

				for (var prop in sample) {
					_loop7(prop);
				}

				return key;
			});

			return op2;
		};

		var parsed = groupThenMap(data, function (d) {
			return d._id['_id_' + toolkit.replace(subchan.breakdownBy(), '.', '_')];
		}).map(function (d) {
			d.breakdowns = d.subs[0]._id;
			d.count = 1;

			return d;
		});

		subchan.level(1);
		var newParsed = _.orderBy(parsed, function (d) {
			return d.PL8A;
		}, 'desc');
		return newParsed;
	};

	subchan.render = function () {
		if (subchan.data().length == 0) {
			$('#subchan').html('No data found.');
			return;
		}

		// ========================= TABLE STRUCTURE

		var percentageWidth = 100;

		var wrapper = toolkit.newEl('div').addClass('pivot-pnl-branch pivot-pnl').appendTo($('#subchan'));

		var tableHeaderWrap = toolkit.newEl('div').addClass('table-header').appendTo(wrapper);

		var tableHeader = toolkit.newEl('table').addClass('table').appendTo(tableHeaderWrap);

		var tableContentWrap = toolkit.newEl('div').appendTo(wrapper).addClass('table-content');

		var tableContent = toolkit.newEl('table').addClass('table').appendTo(tableContentWrap);

		var trHeader = toolkit.newEl('tr').appendTo(tableHeader);

		toolkit.newEl('th').html('P&L').css('height', rpt.rowHeaderHeight() * subchan.level() + 'px').attr('data-rowspan', subchan.level()).css('vertical-align', 'middle').addClass('cell-percentage-header').appendTo(trHeader);

		toolkit.newEl('th').html('Total').css('height', rpt.rowHeaderHeight() * subchan.level() + 'px').attr('data-rowspan', subchan.level()).css('vertical-align', 'middle').addClass('cell-percentage-header align-right').appendTo(trHeader);

		toolkit.newEl('th').html('% of N Sales').css('height', rpt.rowHeaderHeight() * subchan.level() + 'px').css('vertical-align', 'middle').css('font-weight', 'normal').css('font-style', 'italic').width(percentageWidth - 20).attr('data-rowspan', subchan.level()).addClass('cell-percentage-header align-right').appendTo(trHeader);

		var trContents = [];
		for (var i = 0; i < subchan.level(); i++) {
			trContents.push(toolkit.newEl('tr').appendTo(tableContent).css('height', rpt.rowHeaderHeight() + 'px'));
		}

		// ========================= BUILD HEADER

		var data = subchan.data();

		var columnWidth = 130;
		var totalColumnWidth = 0;
		var pnlTotalSum = 0;
		var dataFlat = [];

		var countWidthThenPush = function countWidthThenPush(thheader, each, key) {
			var currentColumnWidth = each._id.length * (subchan.breakdownBy() == 'customer.channelname' ? 7 : 10);
			if (currentColumnWidth < columnWidth) {
				currentColumnWidth = columnWidth;
			}

			if (each.hasOwnProperty('width')) {
				currentColumnWidth = each.width;
			}

			each.key = key.join('_');
			dataFlat.push(each);

			totalColumnWidth += currentColumnWidth;
			thheader.width(currentColumnWidth);
		};

		data.forEach(function (lvl1, i) {
			var thheader1 = toolkit.newEl('th').html(lvl1._id).attr('colspan', lvl1.count).addClass('align-center').css('border-top', 'none').appendTo(trContents[0]);

			if (subchan.level() == 1) {
				countWidthThenPush(thheader1, lvl1, [lvl1._id]);

				totalColumnWidth += percentageWidth;
				var thheader1p = toolkit.newEl('th').html('% of N Sales').width(percentageWidth).addClass('align-center').css('font-weight', 'normal').css('font-style', 'italic').css('border-top', 'none').appendTo(trContents[0]);

				return;
			}
			thheader1.attr('colspan', lvl1.count * 2);

			lvl1.subs.forEach(function (lvl2, j) {
				var thheader2 = toolkit.newEl('th').html(lvl2._id).addClass('align-center').appendTo(trContents[1]);

				if (subchan.level() == 2) {
					countWidthThenPush(thheader2, lvl2, [lvl1._id, lvl2._id]);

					totalColumnWidth += percentageWidth;
					var _thheader1p4 = toolkit.newEl('th').html('% of N Sales').width(percentageWidth).addClass('align-center').css('font-weight', 'normal').css('font-style', 'italic').appendTo(trContents[1]);

					return;
				}
				thheader2.attr('colspan', lvl2.count);
			});
		});

		tableContent.css('min-width', totalColumnWidth);

		// ========================= CONSTRUCT DATA

		var plmodels = _.sortBy(rpt.plmodels(), function (d) {
			return parseInt(d.OrderIndex.replace(/PL/g, ''));
		});
		var exceptions = ["PL94C" /* "Operating Income" */, "PL39B" /* "Earning Before Tax" */, "PL41C" /* "Earning After Tax" */, "PL6A" /* "Discount" */];
		var netSalesPLCode = 'PL8A';
		var netSalesRow = {};
		var grossSalesPLCode = 'PL0';
		var grossSalesRow = {};
		var discountActivityPLCode = 'PL7A';
		var rows = [];

		rpt.fixRowValue(dataFlat);

		console.log("dataFlat", dataFlat);

		dataFlat.forEach(function (e) {
			var breakdown = e.key;
			netSalesRow[breakdown] = e[netSalesPLCode];
			grossSalesRow[breakdown] = e[grossSalesPLCode];
		});

		plmodels.forEach(function (d) {
			var row = { PNL: d.PLHeader3, PLCode: d._id, PNLTotal: 0, Percentage: 0 };
			dataFlat.forEach(function (e) {
				var breakdown = e.key;
				var value = e['' + d._id];
				row[breakdown] = value;

				if (toolkit.isDefined(e.excludeFromTotal)) {
					return;
				}

				row.PNLTotal += value;
			});
			dataFlat.forEach(function (e) {
				var breakdown = e.key;
				var percentage = toolkit.number(row[breakdown] / row.PNLTotal) * 100;
				percentage = toolkit.number(percentage);

				if (d._id == discountActivityPLCode) {
					percentage = toolkit.number(row[breakdown] / grossSalesRow[breakdown]) * 100;
				} else if (d._id != netSalesPLCode) {
					percentage = toolkit.number(row[breakdown] / netSalesRow[breakdown]) * 100;
				}

				if (percentage < 0) percentage = percentage * -1;

				row[breakdown + ' %'] = percentage;
			});

			if (exceptions.indexOf(row.PLCode) > -1) {
				return;
			}

			rows.push(row);
		});

		console.log("rows", rows);

		var TotalNetSales = _.find(rows, function (r) {
			return r.PLCode == netSalesPLCode;
		}).PNLTotal;
		var TotalGrossSales = _.find(rows, function (r) {
			return r.PLCode == grossSalesPLCode;
		}).PNLTotal;
		rows.forEach(function (d, e) {
			var TotalPercentage = d.PNLTotal / TotalNetSales * 100;
			if (d.PLCode == discountActivityPLCode) {
				TotalPercentage = d.PNLTotal / TotalGrossSales * 100;
			}

			if (TotalPercentage < 0) TotalPercentage = TotalPercentage * -1;
			rows[e].Percentage = toolkit.number(TotalPercentage);
		});

		// ========================= PLOT DATA

		rows.forEach(function (d, i) {
			pnlTotalSum += d.PNLTotal;

			var PL = d.PLCode;
			PL = PL.replace(/\s+/g, '');
			var trHeader = toolkit.newEl('tr').addClass('header' + PL).attr('idheaderpl', PL).attr('data-row', 'row-' + i).css('height', rpt.rowContentHeight() + 'px').appendTo(tableHeader);

			trHeader.on('click', function () {
				subchan.clickExpand(trHeader);
			});

			toolkit.newEl('td').html('<i></i>' + d.PNL).appendTo(trHeader);

			var pnlTotal = kendo.toString(d.PNLTotal, 'n0');
			toolkit.newEl('td').html(pnlTotal).addClass('align-right').appendTo(trHeader);

			toolkit.newEl('td').html(kendo.toString(d.Percentage, 'n2') + ' %').addClass('align-right').appendTo(trHeader);

			var trContent = toolkit.newEl('tr').addClass('column' + PL).attr('idpl', PL).attr('data-row', 'row-' + i).css('height', rpt.rowContentHeight() + 'px').appendTo(tableContent);

			dataFlat.forEach(function (e, f) {
				var key = e.key;
				var value = kendo.toString(d[key], 'n0');
				var percentage = kendo.toString(d[key + ' %'], 'n2') + ' %';

				if ($.trim(value) == '') {
					value = 0;
				}

				var cell = toolkit.newEl('td').html(value).addClass('align-right').appendTo(trContent);

				var cellPercentage = toolkit.newEl('td').html(percentage).addClass('align-right').appendTo(trContent);

				$([cell, cellPercentage]).on('click', function () {
					subchan.renderDetail(d.PLCode, e.breakdowns);
				});
			});

			var boolStatus = false;
			trContent.find('td').each(function (a, e) {
				if ($(e).text() != '0' && $(e).text() != '0.00 %') {
					boolStatus = true;
				}
			});

			if (boolStatus) {
				trContent.attr('statusval', 'show');
				trHeader.attr('statusval', 'show');
			} else {
				trContent.attr('statusval', 'hide');
				trHeader.attr('statusval', 'hide');
			}
		});

		// ========================= CONFIGURE THE HIRARCHY
		rpt.buildGridLevels(rows);
	};

	subchan.breakdownBrand = ko.observableArray([]);
	subchan.optionBreakdownBrandValues = ko.observableArray([]);
	subchan.changeBreakdownBrand = function () {
		var all = kac.breakdownValueAll;
		var masterData = [];

		masterData = rpt.masterData.Brand();

		toolkit.runUntil(function (i) {
			subchan.optionBreakdownBrandValues([all].concat(masterData.map(function (d) {
				return { _id: d.Name, Name: d.Name };
			})));

			subchan.breakdownBrand([all._id]);
		}, function (i) {
			return i > 10 || masterData.length > 0;
		});
	};
	subchan.changeBreakdownBrandValue = function () {
		var all = kac.breakdownValueAll;
		setTimeout(function () {
			var condA1 = subchan.breakdownBrand().length == 2;
			var condA2 = subchan.breakdownBrand().indexOf(all._id) == 0;
			if (condA1 && condA2) {
				subchan.breakdownBrand.remove(all._id);
				return;
			}

			var condB1 = subchan.breakdownBrand().length > 1;
			var condB2 = subchan.breakdownBrand().reverse()[0] == all._id;
			if (condB1 && condB2) {
				subchan.breakdownBrand([all._id]);
				return;
			}

			var condC1 = subchan.breakdownBrand().length == 0;
			if (condC1) {
				subchan.breakdownBrand([all._id]);
			}
		}, 100);
	};

	subchan.breakdownDistributor = ko.observableArray([]);
	subchan.optionBreakdownDistributorValues = ko.observableArray([]);
	subchan.changeBreakdownDistributor = function () {
		var all = kac.breakdownValueAll;
		var masterData = [];

		masterData = rpt.masterData.Distributor();

		toolkit.runUntil(function (i) {
			subchan.optionBreakdownDistributorValues([all].concat(masterData.map(function (d) {
				return { _id: d.Name, Name: d.Name };
			})));

			subchan.breakdownDistributor([all._id]);
		}, function (i) {
			return i > 10 || masterData.length > 0;
		});
	};
	subchan.changeBreakdownDistributorValue = function () {
		var all = kac.breakdownValueAll;
		setTimeout(function () {
			var condA1 = subchan.breakdownDistributor().length == 2;
			var condA2 = subchan.breakdownDistributor().indexOf(all._id) == 0;
			if (condA1 && condA2) {
				subchan.breakdownDistributor.remove(all._id);
				return;
			}

			var condB1 = subchan.breakdownDistributor().length > 1;
			var condB2 = subchan.breakdownDistributor().reverse()[0] == all._id;
			if (condB1 && condB2) {
				subchan.breakdownDistributor([all._id]);
				return;
			}

			var condC1 = subchan.breakdownDistributor().length == 0;
			if (condC1) {
				subchan.breakdownDistributor([all._id]);
			}
		}, 100);
	};

	subchan.optionMTBreakdown = ko.observableArray([]);
	subchan.optionAccount = ko.observableArray([]);
	subchan.optionBrand = ko.observableArray([]);
	subchan.optionBranch = ko.observableArray([]);
	subchan.optionDistributor = ko.observableArray([]);

	subchan.fillOptionFilters = function () {
		app.ajaxPost(viewModel.appName + "report/getdatamasterhypersupermini", {}, function (res) {
			subchan.optionMTBreakdown(_.orderBy(res.data.map(function (d) {
				return { _id: d._id, Name: d.Name };
			}), function (d) {
				return d.Name;
			}));
		});

		app.ajaxPost(viewModel.appName + "report/getdatakeyaccount", {}, function (res) {
			subchan.optionAccount(_.orderBy(res.data.map(function (d) {
				return { _id: d._id, Name: d.Name };
			}).concat({ _id: 'OHTER', Name: 'OHTER' }), function (d) {
				return d.Name;
			}));
		});

		app.ajaxPost(viewModel.appName + "report/getdatabrand", {}, function (res) {
			subchan.optionBrand(_.orderBy(res.data.map(function (d) {
				return { _id: d._id, Name: d.Name };
			}), function (d) {
				return d.Name;
			}));
		});

		app.ajaxPost(viewModel.appName + "report/getdatabranch", {}, function (res) {
			subchan.optionBranch(_.orderBy(res.data.map(function (d) {
				return { _id: d.Name, Name: d.Name };
			}), function (d) {
				return d.Name;
			}));
		});

		app.ajaxPost(viewModel.appName + "report/getdatamasterdistributor", {}, function (res) {
			subchan.optionDistributor(_.orderBy(res.data.map(function (d) {
				return { _id: d.Name, Name: d.Name };
			}), function (d) {
				return d.Name;
			}));
		});
	};

	subchan.filterMTBreakdown = ko.observableArray([]);
	subchan.filterAccount = ko.observableArray([]);
	subchan.filterBrand = ko.observableArray([]);
	subchan.filterBranch = ko.observableArray([]);
	subchan.filterDistributor = ko.observableArray([]);

	subchan.injectFilters = function (filters) {
		var DA_LORD_OF_DA_RING = [{ field: 'customer.reportsubchannel', holder: subchan.filterMTBreakdown }, { field: 'customer.keyaccount', holder: subchan.filterAccount }, { field: 'customer.brand', holder: subchan.filterBrand }, { field: 'customer.branchname', holder: subchan.filterBranch }, { field: 'customer.reportsubchannel', holder: subchan.filterDistributor }];

		DA_LORD_OF_DA_RING.filter(function (d) {
			return d.holder().length > 0;
		}).forEach(function (d) {
			var previousFilter = filters.find(function (e) {
				return e.Field == d.field;
			});
			if (toolkit.isDefined(previousFilter)) {
				previousFilter.Value.push(d.holder());
			} else {
				filters.push({
					Field: d.field,
					Op: '$in',
					Value: d.holder()
				});
			}
		});
	};
})();

// ===== JENERATE KOMBINASYON FOR DIS MODUL =====

var MEJIK_FUNC = function MEJIK_FUNC() {
	combinations(["customer.reportsubchannel", "customer.reportchannel", "customer.channelid", "customer.keyaccount", "product.brand", "customer.branch", "customer.customergroupname"]).map(function (d) {
		if (d.indexOf("customer.channelid") > -1) {
			d.push("customer.channelname");
		}

		d.push("date.fiscal");
		return _.orderBy(d).map(function (e) {
			return '"' + e + '"';
		}).join(",");
	}).join(" ");

	var thisis = ["date_fiscal", "date_quartertxt", "date_month", "customer_reportchannel", "customer_reportsubchannel", "customer_channelid", "customer_channelname", "customer_region", "customer_zone", "customer_areaname", "customer_branchname", "customer_keyaccount", "customer_customergroup", "customer_customergroupname", "product_brand"];
};

vm.currentMenu('P&L Performance');
vm.currentTitle('&nbsp;');
vm.breadcrumb([{ title: 'Godrej', href: viewModel.appName + 'page/landing' }, { title: 'Home', href: viewModel.appName + 'page/landing' }, { title: 'P&L Performance', href: '#' }]);

bkd.title('P&L by Channels');
kac.title('&nbsp;');

rpt.refresh = function () {
	$('.tab-pane.active .btn-primary').trigger('click');
};

$(function () {
	rpt.showExport(true);

	subchan.fillOptionFilters();

	bkd.changeBreakdown();
	kac.changeBreakdown();
	kac.changeBreakdownGroup();
	subchan.changeBreakdownBrand();
	subchan.changeBreakdownDistributor();

	toolkit.runAfter(function () {
		kac.breakdownValue(['All']);
		kac.breakdownGroupValue(['KEY']);
		bkd.breakdownValue(['All']);
		subchan.breakdownBrand(['All']);
		subchan.breakdownDistributor(['All']);

		bkd.refresh();
	}, 200);
});