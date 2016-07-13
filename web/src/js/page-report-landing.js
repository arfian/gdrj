viewModel.landing = {}
let lgd = viewModel.landing

lgd.menu = ko.observableArray([
	{ to: 'pnlperformance', title: 'P&L Performance', icon: 'fa-bar-chart', color: 'rgb(10, 114, 183)' },
	{ to: 'distributionanalysis', title: 'Distribution Analysis', icon: 'fa-bus', color: 'rgb(17, 134, 212)' },
	{ to: 'contributionanalysis', title: 'Contribution Analysis', icon: 'fa-plus', color: '#3498DB' },

	{ to: 'growthanalysis', title: 'Growth Analysis', icon: 'fa-area-chart', color: 'rgb(23, 142, 73)' },
	{ to: 'keyaccountanalysis', title: 'Key Account Analysis', icon: 'fa-key', color: 'rgb(32, 162, 87)' },
	{ to: 'salesreturnanalysis', title: 'Sales Return Analysis', icon: 'fa-refresh', color: '#28B463' },

	{ to: 'branchanalysis', title: 'Branch Analysis', icon: 'fa-home', color: 'rgb(212, 130, 0)' },
	{ to: 'rdanalysis', title: 'RD Analysis', icon: 'fa-bar-chart', color: 'rgb(234, 144, 0)' },
	{ to: 'rdvsbranchanalysis', title: 'Branch vs RD Analysis', icon: 'fa-bar-chart', color: '#F39C12' },

	{ to: 'customanalysis', title: 'Custom Analysis', icon: 'fa-gear', color: '#b70f5d' },
])

vm.currentMenu('Home')
vm.currentTitle('Home')
vm.breadcrumb([
	{ title: 'Godrej', href: viewModel.appName + 'page/landing' },
	{ title: 'Home', href: '#' },
])
