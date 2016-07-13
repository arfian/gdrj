'use strict';

viewModel.distribution = {};
var dsbt = viewModel.distribution;

dsbt.changeTo = function (d) {
	if (d == 'Revenue vs EBIT Distribution') {
		toolkit.try(function () {
			$('#tab1 .k-grid').data('kendoGrid').refresh();
		});
	}
};

viewModel.revenueEbit = {};
var rve = viewModel.revenueEbit;
rve.contentIsLoading = ko.observable(false);
rve.plNetSales = ko.observable('');
rve.plEBIT = ko.observable('');
rve.breakdown = ko.observable('customer.channelname');
rve.fiscalYear = ko.observable(rpt.value.FiscalYear());

rve.refresh = function () {
	var param = {};
	param.pls = [rve.plNetSales(), rve.plEBIT()];
	param.groups = rpt.parseGroups([rve.breakdown()]);
	param.aggr = 'sum';
	param.flag = 'branch-vs-rd';
	param.filters = rpt.getFilterValue(false, rve.fiscalYear);

	var fetch = function fetch() {
		toolkit.ajaxPost(viewModel.appName + "report/getpnldatanew", param, function (res) {
			if (res.Status == "NOK") {
				setTimeout(function () {
					fetch();
				}, 1000 * 5);
				return;
			}

			if (rpt.isEmptyData(res)) {
				rve.contentIsLoading(false);
				return;
			}

			rve.contentIsLoading(false);
			rve.render(res);
		}, function () {
			rve.contentIsLoading(false);
		});
	};

	rve.contentIsLoading(true);
	fetch();
};

rve.render = function (res) {
	var data = res.Data.Data;

	var compare1 = rpt.plmodels().find(function (d) {
		return d._id == rve.plNetSales();
	});
	var compare2 = rpt.plmodels().find(function (d) {
		return d._id == rve.plEBIT();
	});

	// Branch

	var dataBranch = _.filter(data, function (d) {
		return d._id._id_branchrd == 'Branch';
	});
	var dataBranchGT = _.filter(dataBranch, function (d) {
		return d._id._id_customer_channelname == 'General Trade';
	});
	var dataBranchMT = _.filter(dataBranch, function (d) {
		return d._id._id_customer_channelname == 'Modern Trade';
	});
	var dataBranchOther = _.filter(dataBranch, function (d) {
		return ['General Trade', 'Modern Trade'].indexOf(d._id._id_customer_channelname) == -1;
	});

	var rowBranch = {};
	rowBranch.name = 'Branch';

	rowBranch.netSalesTotal = toolkit.sum(dataBranch, function (d) {
		return d[rve.plNetSales()];
	});
	rowBranch.netSalesGT = toolkit.sum(dataBranchGT, function (d) {
		return d[rve.plNetSales()];
	});
	rowBranch.netSalesMT = toolkit.sum(dataBranchMT, function (d) {
		return d[rve.plNetSales()];
	});
	rowBranch.netSalesOther = toolkit.sum(dataBranchOther, function (d) {
		return d[rve.plNetSales()];
	});

	rowBranch.ebitTotal = toolkit.sum(dataBranch, function (d) {
		return d[rve.plEBIT()];
	});
	rowBranch.ebitGT = toolkit.sum(dataBranchGT, function (d) {
		return d[rve.plEBIT()];
	});
	rowBranch.ebitMT = toolkit.sum(dataBranchMT, function (d) {
		return d[rve.plEBIT()];
	});
	rowBranch.ebitOther = toolkit.sum(dataBranchOther, function (d) {
		return d[rve.plEBIT()];
	});

	rowBranch.netSalesTotalPercentage = 100;
	rowBranch.netSalesGTPercentage = toolkit.number(rowBranch.netSalesGT / rowBranch.netSalesTotal) * 100;
	rowBranch.netSalesMTPercentage = toolkit.number(rowBranch.netSalesMT / rowBranch.netSalesTotal) * 100;
	rowBranch.netSalesOtherPercentage = toolkit.number(rowBranch.netSalesOther / rowBranch.netSalesTotal) * 100;

	rowBranch.ebitTotalPercentage = 100;
	rowBranch.ebitGTPercentage = toolkit.number(rowBranch.ebitGT / rowBranch.ebitTotal) * 100;
	rowBranch.ebitMTPercentage = toolkit.number(rowBranch.ebitMT / rowBranch.ebitTotal) * 100;
	rowBranch.ebitOtherPercentage = toolkit.number(rowBranch.ebitOther / rowBranch.ebitTotal) * 100;

	// RD

	var dataRD = _.filter(data, function (d) {
		return d._id._id_branchrd == 'Regional Distributor';
	});
	var dataRDGT = _.filter(dataRD, function (d) {
		return d._id._id_customer_channelname == 'General Trade';
	});
	var dataRDMT = _.filter(dataRD, function (d) {
		return d._id._id_customer_channelname == 'Modern Trade';
	});
	var dataRDOther = _.filter(dataRD, function (d) {
		return ['General Trade', 'Modern Trade'].indexOf(d._id._id_customer_channelname) == -1;
	});

	var rowRD = {};
	rowRD.name = 'RD';

	rowRD.netSalesTotal = toolkit.sum(dataRD, function (d) {
		return d[rve.plNetSales()];
	});
	rowRD.netSalesGT = toolkit.sum(dataRDGT, function (d) {
		return d[rve.plNetSales()];
	});
	rowRD.netSalesMT = toolkit.sum(dataRDMT, function (d) {
		return d[rve.plNetSales()];
	});
	rowRD.netSalesOther = toolkit.sum(dataRDOther, function (d) {
		return d[rve.plNetSales()];
	});

	rowRD.ebitTotal = toolkit.sum(dataRD, function (d) {
		return d[rve.plEBIT()];
	});
	rowRD.ebitGT = toolkit.sum(dataRDGT, function (d) {
		return d[rve.plEBIT()];
	});
	rowRD.ebitMT = toolkit.sum(dataRDMT, function (d) {
		return d[rve.plEBIT()];
	});
	rowRD.ebitOther = toolkit.sum(dataRDOther, function (d) {
		return d[rve.plEBIT()];
	});

	rowRD.netSalesTotalPercentage = 100;
	rowRD.netSalesGTPercentage = toolkit.number(rowRD.netSalesGT / rowRD.netSalesTotal) * 100;
	rowRD.netSalesMTPercentage = toolkit.number(rowRD.netSalesMT / rowRD.netSalesTotal) * 100;
	rowRD.netSalesOtherPercentage = toolkit.number(rowRD.netSalesOther / rowRD.netSalesTotal) * 100;

	rowRD.ebitTotalPercentage = 100;
	rowRD.ebitGTPercentage = toolkit.number(rowRD.ebitGT / rowRD.ebitTotal) * 100;
	rowRD.ebitMTPercentage = toolkit.number(rowRD.ebitMT / rowRD.ebitTotal) * 100;
	rowRD.ebitOtherPercentage = toolkit.number(rowBranch.ebitOther / rowBranch.ebitTotal) * 100;

	var dataParsed = [rowBranch, rowRD];
	console.log(rowBranch, rowRD);

	var columns = [{
		title: '&nbsp;',
		field: 'name',
		locked: true,
		width: 120
	}, {
		title: compare1.PLHeader3,
		headerAttributes: { class: 'align-center color-0' },
		columns: [{
			title: 'Total',
			headerAttributes: { style: 'text-align: center; vertical-align: middle; font-weight: bold;' },
			width: 120,
			field: 'netSalesTotal',
			attributes: { class: 'align-right' },
			format: '{0:n0}'
		}, {
			title: 'GT',
			headerAttributes: { class: 'align-center' },
			columns: [{ headerAttributes: { style: 'text-align: center;' }, width: 120, title: 'Value', field: 'netSalesGT', attributes: { class: 'align-right' }, format: '{0:n0}' }, { headerAttributes: { style: 'text-align: center; font-style: italic;' }, width: 80, title: '% of Total', field: 'netSalesGTPercentage', attributes: { class: 'align-right', style: 'border-right: 1px solid rgb(240, 243, 244);' }, format: '{0:n2} %' }]
		}, {
			title: 'MT',
			headerAttributes: { class: 'align-center' },
			columns: [{ headerAttributes: { style: 'text-align: center;' }, width: 120, title: 'Value', field: 'netSalesMT', attributes: { class: 'align-right' }, format: '{0:n0}' }, { headerAttributes: { style: 'text-align: center; font-style: italic;' }, width: 80, title: '% of Total', field: 'netSalesMTPercentage', attributes: { class: 'align-right', style: 'border-right: 1px solid rgb(240, 243, 244);' }, format: '{0:n2} %' }]
		}, {
			title: 'Other',
			headerAttributes: { class: 'align-center' },
			columns: [{ headerAttributes: { style: 'text-align: center;' }, width: 120, title: 'Value', field: 'netSalesOther', attributes: { class: 'align-right' }, format: '{0:n0}' }, { headerAttributes: { style: 'text-align: center; font-style: italic;' }, width: 80, title: '% of Total', field: 'netSalesOtherPercentage', attributes: { class: 'align-right', style: 'border-right: 1px solid rgb(240, 243, 244);' }, format: '{0:n2} %' }]
		}]
	}, {
		title: compare2.PLHeader3,
		headerAttributes: { class: 'align-center color-1' },
		columns: [{
			title: 'Total',
			headerAttributes: { style: 'text-align: center; vertical-align: middle; font-weight: bold;' },
			width: 120,
			field: 'ebitTotal',
			attributes: { class: 'align-right' },
			format: '{0:n0}'
		}, {
			title: 'GT',
			headerAttributes: { class: 'align-center' },
			columns: [{ headerAttributes: { style: 'text-align: center;' }, width: 120, title: 'Value', field: 'ebitGT', attributes: { class: 'align-right' }, format: '{0:n0}' }, { headerAttributes: { style: 'text-align: center; font-style: italic;' }, width: 80, title: '% of Total', field: 'ebitGTPercentage', attributes: { class: 'align-right', style: 'border-right: 1px solid rgb(240, 243, 244);' }, format: '{0:n2} %' }]
		}, {
			title: 'MT',
			headerAttributes: { class: 'align-center' },
			columns: [{ headerAttributes: { style: 'text-align: center;' }, width: 120, title: 'Value', field: 'ebitMT', attributes: { class: 'align-right' }, format: '{0:n0}' }, { headerAttributes: { style: 'text-align: center; font-style: italic;' }, width: 80, title: '% of Total', field: 'ebitMTPercentage', attributes: { class: 'align-right', style: 'border-right: 1px solid rgb(240, 243, 244);' }, format: '{0:n2} %' }]
		}, {
			title: 'Other',
			headerAttributes: { class: 'align-center' },
			columns: [{ headerAttributes: { style: 'text-align: center;' }, width: 120, title: 'Value', field: 'ebitOther', attributes: { class: 'align-right' }, format: '{0:n0}' }, { headerAttributes: { style: 'text-align: center; font-style: italic;' }, width: 80, title: '% of Total', field: 'ebitOtherPercentage', attributes: { class: 'align-right', style: 'border-right: 1px solid rgb(240, 243, 244);' }, format: '{0:n2} %' }]
		}]
	}];

	var config = {
		dataSource: {
			data: dataParsed
		},
		columns: columns,
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

	$('.grid-revenue-ebit').replaceWith('<div class="grid-revenue-ebit"></div>');
	$('.grid-revenue-ebit').kendoGrid(config);
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
sd.getPLModels = function (c) {
	app.ajaxPost(viewModel.appName + "report/getplmodel", {}, function (res) {
		sd.selectedPL('');
		rpt.plmodels(_.orderBy(res, function (d) {
			return d.OrderIndex;
		}));
		sd.selectedPL('PL8A');

		rve.plNetSales('PL8A');
		rve.plEBIT('PL44B');

		c(res);
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
sd.sortVal = ['desc', 'desc', 'desc', '', 'desc', ''];
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

			if (rpt.isEmptyData(res)) {
				sd.contentIsLoading(false);
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

vm.currentMenu('Analysis');
vm.currentTitle('&nbsp;');
vm.breadcrumb([{ title: 'Godrej', href: viewModel.appName + 'page/landing' }, { title: 'Home', href: viewModel.appName + 'page/landing' }, { title: 'Distribution Analysis', href: '#' }]);

$(function () {
	rpt.tabbedContent();

	sd.refresh();
	sd.initSort();
	sd.getPLModels(function () {
		rve.refresh();
	});
});