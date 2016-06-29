'use strict';

// cd $GOPATH/src/eaciit/gdrj && cat config/configurations.json

// let plcodes = [
// 	{ plcodes: ["PL1", "PL2", "PL3", "PL4", "PL5", "PL6"], title: 'Gross Sales' },
// 	// growth
// 	{ plcodes: ["PL7", "PL8"], title: 'Sales Discount' },
// 	// ATL
// 	// BTL
// 	{ plcode: "PL74B", title: "COGS" },
// 	{ plcode: "PL74C", title: "Gross Margin" },
// 	{ plcode: "PL94A", title: "SGNA" },
// 	{ plcode: "PL26", title: "Royalties" }
// 	{ plcode: "PL44B", title: "EBIT" },
// 	{ plcode: "PL44C", title: "EBITDA" },

// 	{ plcode: "PL74C", title: "GM" },
// 	{ plcode: "PL74B", title: "COGS" },
// 	{ plcode: "PL44B", title: "EBIT" },
// 	{ plcode: "PL44C", title: "EBITDA" },
// 	{ plcode: "PL8A", title: "Net Sales" },

// ]

vm.currentMenu('Dashboard');
vm.currentTitle("Dashboard");
vm.breadcrumb([{ title: 'Godrej', href: '#' }, { title: 'Dashboard', href: '/report/dashboard' }]);

viewModel.dashboard = {};
var dsbrd = viewModel.dashboard;

dsbrd.rows = ko.observableArray([
// { pnl: 'Gross Sales', plcodes: ["PL1", "PL2", "PL3", "PL4", "PL5", "PL6"] },
{ pnl: "Net Sales", plcodes: ["PL8A"] }, { pnl: 'Growth', plcodes: [] }, // NOT YET
{ pnl: 'Sales Discount', plcodes: ["PL7", "PL8"] },
// { pnl: 'ATL', plcodes: ["PL28"] },
// { pnl: 'BTL', plcodes: ["PL29", "PL30", "PL31", "PL32"] },
{ pnl: "COGS", plcodes: ["PL74B"] }, { pnl: "Gross Margin", plcodes: ["PL74C"] }, { pnl: "SGA", plcodes: ["PL94A"] }, { pnl: "Royalties", plcodes: ["PL26A"] }, { pnl: "EBITDA", plcodes: ["PL44C"] }, { pnl: "EBIT %", plcodes: [] }, { pnl: "EBIT", plcodes: ["PL44B"] }]);

dsbrd.data = ko.observableArray([]);
dsbrd.columns = ko.observableArray([]);
dsbrd.breakdown = ko.observable('customer.channelname');
dsbrd.fiscalYears = ko.observableArray(rpt.value.FiscalYears());
dsbrd.contentIsLoading = ko.observable(false);
dsbrd.optionStructures = ko.observableArray([{ field: "date.fiscal", name: "Fiscal Year" }, { field: "date.quartertxt", name: "Quarter" }, { field: "date.month", name: "Month" }]);
dsbrd.structure = ko.observable(dsbrd.optionStructures()[0].field);
dsbrd.structureYear = ko.observable('date.year');
dsbrd.optionBreakdownValues = ko.observableArray([]);
dsbrd.breakdownValue = ko.observableArray([]);
dsbrd.breakdownValueAll = { _id: 'All', Name: 'All' };
dsbrd.changeBreakdown = function () {
	var all = dsbrd.breakdownValueAll;
	var map = function map(arr) {
		return arr.map(function (d) {
			if (dsbrd.breakdown() == "customer.channelname") {
				return d;
			}

			return { _id: d.Name, Name: d.Name };
		});
	};
	setTimeout(function () {
		switch (dsbrd.breakdown()) {
			case "customer.branchname":
				dsbrd.optionBreakdownValues([all].concat(map(rpt.masterData.Branch())));
				dsbrd.breakdownValue([all._id]);
				break;
			case "product.brand":
				dsbrd.optionBreakdownValues([all].concat(map(rpt.masterData.Brand())));
				dsbrd.breakdownValue([all._id]);
				break;
			case "customer.channelname":
				dsbrd.optionBreakdownValues([all].concat(map(rpt.masterData.Channel())));
				dsbrd.breakdownValue([all._id]);
				break;
			case "customer.zone":
				dsbrd.optionBreakdownValues([all].concat(map(rpt.masterData.Zone())));
				dsbrd.breakdownValue([all._id]);
				break;
			case "customer.areaname":
				dsbrd.optionBreakdownValues([all].concat(map(rpt.masterData.Area())));
				dsbrd.breakdownValue([all._id]);
				break;
			case "customer.region":
				dsbrd.optionBreakdownValues([all].concat(map(rpt.masterData.Region())));
				dsbrd.breakdownValue([all._id]);
				break;
			case "customer.keyaccount":
				dsbrd.optionBreakdownValues([all].concat(map(rpt.masterData.KeyAccount())));
				dsbrd.breakdownValue([all._id]);
				break;
		}
	}, 100);
};

dsbrd.changeBreakdownValue = function () {
	var all = dsbrd.breakdownValueAll;
	setTimeout(function () {
		var condA1 = dsbrd.breakdownValue().length == 2;
		var condA2 = dsbrd.breakdownValue().indexOf(all._id) == 0;
		if (condA1 && condA2) {
			dsbrd.breakdownValue.remove(all._id);
			return;
		}

		var condB1 = dsbrd.breakdownValue().length > 1;
		var condB2 = dsbrd.breakdownValue().reverse()[0] == all._id;
		if (condB1 && condB2) {
			dsbrd.breakdownValue([all._id]);
			return;
		}

		var condC1 = dsbrd.breakdownValue().length == 0;
		if (condC1) {
			dsbrd.breakdownValue([all._id]);
		}
	}, 100);
};

dsbrd.refresh = function () {
	if (dsbrd.breakdownValue().length == 0) {
		toolkit.showError('Please choose at least breakdown value');
		return;
	}

	var param = {};
	param.pls = _.flatten(dsbrd.rows().map(function (d) {
		return d.plcodes;
	}));
	param.groups = rpt.parseGroups([dsbrd.breakdown(), dsbrd.structure()]);
	param.aggr = 'sum';
	param.filters = rpt.getFilterValue(true, dsbrd.fiscalYears);

	var breakdownValue = dsbrd.breakdownValue().filter(function (d) {
		return d != 'All';
	});
	if (breakdownValue.length > 0) {
		param.filters.push({
			Field: dsbrd.breakdown(),
			Op: '$in',
			Value: dsbrd.breakdownValue()
		});
	}

	if (dsbrd.structure() == 'date.month') {
		param.groups.push(dsbrd.structureYear());
	}

	var fetch = function fetch() {
		toolkit.ajaxPost(viewModel.appName + "report/getpnldatanew", param, function (res) {
			if (res.Status == "NOK") {
				setTimeout(function () {
					fetch();
				}, 1000 * 5);
				return;
			}
			console.log(res);
			dsbrd.contentIsLoading(false);
			dsbrd.render(res);
		}, function () {
			dsbrd.contentIsLoading(false);
		});
	};

	dsbrd.contentIsLoading(true);
	fetch();
};

dsbrd.render = function (res) {
	var rows = [];
	var rowsAfter = [];
	var columnsPlaceholder = [{
		field: 'pnl',
		title: 'PNL',
		attributes: { class: 'bold' },
		headerAttributes: { style: 'font-weight: bold; vertical-align: middle;' },
		width: 120
	}, {
		field: 'total',
		title: 'Total',
		attributes: { class: 'bold align-right bold' },
		headerAttributes: { style: 'font-weight: bold; vertical-align: middle; text-align: right;' },
		width: 150
	}];

	var data = res.Data.Data;

	dsbrd.rows().forEach(function (row, rowIndex) {
		row.columnData = [];
		data.forEach(function (column, columnIndex) {
			var columnAfter = {
				breakdownTitle: toolkit.redefine(column._id['_id_' + toolkit.replace(dsbrd.breakdown(), '.', '_')]),
				structureTitle: toolkit.redefine(column._id['_id_' + toolkit.replace(dsbrd.structure(), '.', '_')]),
				structureYearTitle: toolkit.redefine(column._id['_id_' + toolkit.replace(dsbrd.structureYear(), '.', '_')]),
				original: toolkit.sum(row.plcodes, function (plcode) {
					return toolkit.number(column[plcode]);
				}),
				value: toolkit.sum(row.plcodes, function (plcode) {
					return toolkit.number(column[plcode]);
				})
			};

			row.columnData.push(columnAfter);
		});

		rowsAfter.push(row);
	});

	if (rowsAfter.length > 0) {
		(function () {
			var grossSales = rowsAfter.find(function (d) {
				return d.pnl == 'Net Sales';
			});
			var ebit = rowsAfter.find(function (d) {
				return d.pnl == 'EBIT';
			});
			var columns = rowsAfter[0].columnData;

			rowsAfter.forEach(function (row, rowIndex) {
				row.columnData.forEach(function (column, columnIndex) {
					if (row.pnl == 'EBIT %') {
						var percentage = kendo.toString(toolkit.number(ebit.columnData[columnIndex].original / grossSales.columnData[columnIndex].original) * 100, 'n2');
						column.value = percentage + ' %';
					} else if (row.pnl != 'Net Sales' && row.pnl != 'EBIT') {
						var _percentage = kendo.toString(toolkit.number(column.original / grossSales.columnData[columnIndex].original) * 100, 'n2');
						column.value = _percentage + ' %';
					}
				});

				var total = toolkit.sum(row.columnData, function (d) {
					return d.original;
				});
				row.total = kendo.toString(total, 'n0');
				if (row.pnl == 'EBIT %') {
					var totalGrossSales = toolkit.sum(grossSales.columnData, function (d) {
						return d.original;
					});
					var totalEbit = toolkit.sum(ebit.columnData, function (d) {
						return d.original;
					});
					var percentage = toolkit.number(totalEbit / totalGrossSales) * 100;
					row.total = kendo.toString(percentage, 'n2') + ' %';
				}
			});
		})();
	}

	var columnData = [];
	data.forEach(function (d, i) {
		var columnInfo = rowsAfter[0].columnData[i];

		var column = {};
		column.field = 'columnData[' + i + '].value';
		column.breakdown = $.trim(toolkit.redefine(columnInfo.breakdownTitle, ''));
		column.title = $.trim(columnInfo.structureTitle);
		column.width = 150;
		column.format = '{0:n0}';
		column.attributes = { class: 'align-right' };
		column.headerAttributes = {
			style: 'text-align: center !important; font-weight: bold; border-right: 1px solid white; '
		};

		if (dsbrd.structure() == 'date.month') {
			column.titleYear = $.trim(columnInfo.structureYearTitle);
		}

		columnData.push(column);
	});

	var op1 = _.groupBy(columnData, function (d) {
		return d.breakdown;
	});
	var op2 = _.map(op1, function (v, k) {
		v.forEach(function (h) {
			h.month = h.title;
			h.year = h.titleYear;

			if (dsbrd.structure() == 'date.month') {
				var month = moment(new Date(2015, parseInt(h.title, 10) - 1, 1)).format('MMMM');
				h.title = month;

				if (rpt.value.FiscalYears().length > 1) {
					h.title = month + ' ' + h.titleYear;
				}
			}
		});

		return {
			title: $.trim(k) == '' ? '' : k,
			columns: v,
			headerAttributes: {
				style: 'text-align: center !important; font-weight: bold; border: 1px solid white; border-top: none; border-left: none; box-sizing: border-box; background-color: #e9eced;'
			}
		};
	});

	var columnGrouped = _.sortBy(op2, function (d) {
		return d.title;
	});

	op2.forEach(function (d) {
		d.columns = _.sortBy(d.columns, function (e) {
			if (dsbrd.structure() == 'date.month') {
				var monthString = ('0' + e.month).split('').reverse().slice(0, 2).reverse().join('');

				if (rpt.value.FiscalYears().length > 1) {
					var yearMonthString = '' + e.year + monthString;
					return yearMonthString;
				}

				return monthString;
			}

			return e.title;
		});
	});

	if (columnGrouped.length > 0) {
		columnsPlaceholder[0].locked = true;
		columnsPlaceholder[1].locked = true;
	}

	columnGrouped = _.orderBy(columnGrouped, function (d) {
		var value = 0;
		var dataColumn = rowsAfter[0].columnData.find(function (e) {
			return $.trim(e.breakdownTitle) == $.trim(d.title);
		});
		if (typeof dataColumn != 'undefined') {
			value = dataColumn.value;
		}

		return value;
	}, 'desc');

	dsbrd.data(rowsAfter);
	dsbrd.columns(columnsPlaceholder.concat(columnGrouped));

	var grossSales = dsbrd.data().find(function (d) {
		return d.pnl == "Net Sales";
	});
	var growth = dsbrd.data().find(function (d) {
		return d.pnl == "Growth";
	});

	var counter = 0;
	var prevIndex = 0;
	columnGrouped.forEach(function (d) {
		d.columns.forEach(function (e, i) {
			var index = toolkit.getNumberFromString(e.field);

			if (i + 1 == d.columns.length) {
				e.attributes.style = e.attributes.style + '; border-right: 1px solid rgb(240, 243, 244);';
			}

			if (i == 0) {
				prevIndex = index;
				counter++;
				return;
			}

			var gs = grossSales.columnData[index];
			var gsPrev = grossSales.columnData[prevIndex];
			var g = growth.columnData[index];
			var value = toolkit.number((gs.value - gsPrev.value) / gsPrev.value) * 100;
			g.value = kendo.toString(value, 'n2') + ' %';

			counter++;
			prevIndex = index;
		});
	});

	var config = {
		dataSource: {
			data: dsbrd.data()
		},
		columns: dsbrd.columns(),
		resizable: false,
		sortable: false,
		pageable: false,
		filterable: false,
		dataBound: function dataBound() {
			var sel = '.grid-dashboard .k-grid-content-locked tr, .grid-dashboard .k-grid-content tr';

			$(sel).on('mouseenter', function () {
				var index = $(this).index();
				console.log(this, index);
				var elh = $('.grid-dashboard .k-grid-content-locked tr:eq(' + index + ')').addClass('hover');
				var elc = $('.grid-dashboard .k-grid-content tr:eq(' + index + ')').addClass('hover');
			});
			$(sel).on('mouseleave', function () {
				$('.grid-dashboard tr.hover').removeClass('hover');
			});
		}
	};

	$('.grid-dashboard').replaceWith('<div class="grid-dashboard"></div>');
	$('.grid-dashboard').kendoGrid(config);
};

viewModel.salesDistribution = {};
var sd = viewModel.salesDistribution;
sd.contentIsLoading = ko.observable(false);
sd.isFirstTime = ko.observable(true);
sd.breakdown = ko.observable('customer.reportchannel');
sd.breakdownSub = ko.observable('customer.reportsubchannel');
sd.data = ko.observableArray([]);
sd.fiscalYear = ko.observable(rpt.value.FiscalYear());
sd.selectedPL = ko.observable('PL8A');
sd.getPLModels = function () {
	app.ajaxPost(viewModel.appName + "report/getplmodel", {}, function (res) {
		sd.selectedPL('');
		rpt.plmodels(_.orderBy(res, function (d) {
			return d.OrderIndex;
		}));
		sd.selectedPL('PL8A');
	});
};
sd.render = function (res) {
	var isFirstTime = sd.isFirstTime();
	sd.isFirstTime(false);

	var data = res.Data.Data;

	var breakdown = toolkit.replace(sd.breakdown(), ".", "_");
	var total = toolkit.sum(data, function (d) {
		return d[sd.selectedPL()];
	});

	sd.data(data);

	var rows = data.map(function (d) {
		var row = {};

		var breakdownAbbr = d._id['_id_' + breakdown];
		row[breakdown] = breakdownAbbr;
		switch (breakdownAbbr) {
			case "MT":
				row[breakdown] = "Modern Trade";break;
			case "GT":
				row[breakdown] = "General Trade";break;
			case "IT":
				row[breakdown] = "Industrial";break;
			case "RD":
				row[breakdown] = "Regional Distributor";break;
			case "EXPORT":
				row[breakdown] = "Export";break;
			case "Motoris":
				row[breakdown] = "Motorist";break;
			default:
				row[breakdown] = breakdownAbbr;
		}

		row.group = d._id['_id_' + toolkit.replace(sd.breakdownSub(), '.', '_')];
		row.percentage = toolkit.number(d[sd.selectedPL()] / total) * 100;
		row.value = d[sd.selectedPL()];
		return row;
	});

	sd.data(rows);
	// sd.data(_.sortBy(rows, (d) => {
	// 	let subGroup = `00${toolkit.number(toolkit.getNumberFromString(d.group))}`.split('').reverse().splice(0, 2).reverse().join('')
	// 	let group = d[breakdown]

	// 	switch (d[breakdown]) {
	// 		case "MT": group = "A"; break
	// 		case "GT": group = "B"; break
	// 		case "IT": group = "C"; break
	// 	}

	// 	return [group, subGroup].join(' ')
	// }))

	var op0 = _.filter(sd.data(), function (d) {
		return d.percentage != 0 || d.value != 0;
	});
	var op1 = _.groupBy(op0, function (d) {
		return d[breakdown];
	});
	var op2 = _.map(op1, function (v, k) {
		return { key: k, values: v };
	});
	var op3 = _.orderBy(op2, function (d) {
		return toolkit.sum(d.values, function (e) {
			return e.percentage;
		});
	}, 'desc');

	// // hack IT, too much data
	// let it = op3.find((d) => d.key == "IT")
	// if (it != undefined) {
	// 	if (it.values.length > 0) {
	// 		let totalIT = toolkit.sum(it.values, (e) => e.value)
	// 		let fake = {}
	// 		fake.customer_reportchannel = it.values[0].customer_reportchannel
	// 		fake.group = it.group
	// 		fake.percentage = toolkit.number(totalIT / total) * 100
	// 		fake.value = totalIT

	// 		it.valuesBackup = it.values.slice(0)
	// 		it.values = [fake]
	// 	}
	// }

	var maxRow = _.maxBy(op3, function (d) {
		return d.values.length;
	});
	var maxRowIndex = op3.indexOf(maxRow);
	var height = 20 * maxRow.values.length;
	var width = 280;

	var container = $('.grid-sales-dist').empty();
	var table = toolkit.newEl('table').addClass('width-full').appendTo(container).height(height);
	var tr1st = toolkit.newEl('tr').appendTo(table).addClass('head');
	var tr2nd = toolkit.newEl('tr').appendTo(table);

	table.css('width', op3.length * width);

	var index = 0;
	op3.forEach(function (d) {
		var td1st = toolkit.newEl('td').appendTo(tr1st).width(width).addClass('sortsales').attr('sort', sd.sortVal[index]).css('cursor', 'pointer');

		var sumPercentage = _.sumBy(d.values, function (e) {
			return e.percentage;
		});
		var sumColumn = _.sumBy(d.values, function (e) {
			return e.value;
		});
		td1st.html('<i class="fa"></i>\n\t\t\t' + d.key + '<br />\n\t\t\t' + kendo.toString(sumPercentage, 'n2') + ' %<br />\n\t\t\t' + kendo.toString(sumColumn, 'n2'));

		var td2nd = toolkit.newEl('td').appendTo(tr2nd).css('vertical-align', 'top');

		var innerTable = toolkit.newEl('table').appendTo(td2nd);
		var innerTbody = toolkit.newEl('tbody').appendTo(innerTable);

		if (d.values.length == 1) {
			var tr = toolkit.newEl('tr').appendTo(innerTbody);
			toolkit.newEl('td').appendTo(tr).html(kendo.toString(d.values[0].value, 'n0')).addClass('single');

			// index++
			// return
		}

		var op1 = _.groupBy(d.values, function (o) {
			return o.group;
		});
		var channelgroup = _.map(op1, function (v, k) {
			if (k == '') k = '';
			return { key: k, values: v };
		});

		var totalyo = 0,
		    percentageyo = 0,
		    indexyo = 0;
		channelgroup.forEach(function (e) {
			totalyo = toolkit.sum(e.values, function (b) {
				return b.value;
			});
			percentageyo = toolkit.number(totalyo / sumColumn * 100);
			channelgroup[indexyo]['totalyo'] = totalyo;
			channelgroup[indexyo]['percentageyo'] = percentageyo;
			indexyo++;
		});
		if (sd.sortVal[index] == '') {
			channelgroup = _.orderBy(channelgroup, ['key'], ['asc']);
			$('.sortsales:eq(' + index + ')>i').removeClass('fa-chevron-up');
			$('.sortsales:eq(' + index + ')>i').removeClass('fa-chevron-down');
		} else if (sd.sortVal[index] == 'asc') {
			channelgroup = _.orderBy(channelgroup, ['totalyo'], ['asc']);
			$('.sortsales:eq(' + index + ')>i').removeClass('fa-chevron-up');
			$('.sortsales:eq(' + index + ')>i').addClass('fa-chevron-down');
		} else if (sd.sortVal[index] == 'desc') {
			channelgroup = _.orderBy(channelgroup, ['totalyo'], ['desc']);
			$('.sortsales:eq(' + index + ')>i').addClass('fa-chevron-up');
			$('.sortsales:eq(' + index + ')>i').removeClass('fa-chevron-down');
		}

		// let op2 = _.orderBy(channelgroup, (e) => e.totalyo, 'desc')
		if (d.values.length > 1) {
			channelgroup.forEach(function (e) {
				var tr = toolkit.newEl('tr').appendTo(innerTable);
				toolkit.newEl('td').css('width', '150px').appendTo(tr).html(e.key);
				toolkit.newEl('td').css('width', '40px').appendTo(tr).html(kendo.toString(e.percentageyo, 'n2') + '&nbsp;%');
				toolkit.newEl('td').css('width', '120px').appendTo(tr).html(kendo.toString(e.totalyo, 'n0'));
			});
		}

		index++;
	});

	var trTotalTop = toolkit.newEl('tr').prependTo(table);
	toolkit.newEl('td').addClass('align-center total').attr('colspan', op3.length).appendTo(trTotalTop).html(kendo.toString(total, 'n0'));

	var trTotalBottom = toolkit.newEl('tr').appendTo(table);
	toolkit.newEl('td').addClass('align-center total').attr('colspan', op3.length).appendTo(trTotalBottom).html(kendo.toString(total, 'n0'));
	$(".grid-sales-dist>table tbody>tr:eq(1) td").each(function (index) {
		// $(this).find('table').height($(".grid-sales-dist>table tbody>tr:eq(1)").height())
	});
};
sd.sortVal = ['', '', '', '', '', ''];
sd.sortData = function () {
	sd.render(sd.oldData());
};
sd.oldData = ko.observable({});
sd.refresh = function () {
	var param = {};
	param.pls = [sd.selectedPL()];
	param.groups = rpt.parseGroups([sd.breakdown(), sd.breakdownSub()]);
	param.aggr = 'sum';
	param.filters = rpt.getFilterValue(false, sd.fiscalYear);

	var fetch = function fetch() {
		toolkit.ajaxPost(viewModel.appName + "report/getpnldatanew", param, function (res) {
			if (res.Status == "NOK") {
				setTimeout(function () {
					fetch();
				}, 1000 * 5);
				return;
			}

			sd.oldData(res);
			sd.contentIsLoading(false);
			sd.render(res);
		}, function () {
			sd.contentIsLoading(false);
		});
	};

	sd.contentIsLoading(true);
	fetch();
};
sd.initSort = function () {
	$(".grid-sales-dist").on('click', '.sortsales', function () {
		var sort = $(this).attr('sort'),
		    index = $(this).index(),
		    res = '';
		if (sort == undefined || sort == '') res = 'asc';else if (sort == 'asc') res = 'desc';else res = '';

		sd.sortVal[index] = res;
		sd.sortData();
	});
};

$(function () {
	rpt.tabbedContent();
	rpt.refreshView('dashboard');

	dsbrd.changeBreakdown();
	setTimeout(function () {
		dsbrd.breakdownValue(['All']);
		dsbrd.refresh();
	}, 200);

	rank.refresh();
	sd.refresh();
	sd.initSort();
	sd.getPLModels();
});