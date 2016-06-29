'use strict';

vm.currentMenu('Administration');
vm.currentTitle("Access");
vm.breadcrumb([{ title: 'Godrej', href: '#' }, { title: 'Administration', href: '#' }, { title: 'Access', href: '/access' }]);

viewModel.Access = new Object();
var ac = viewModel.Access;

ac.templateAccess = {
    _id: "",
    Title: "",
    Group1: "",
    Group2: "",
    Group3: "",
    Enable: false,
    SpecialAccess1: "",
    SpecialAccess2: "",
    SpecialAccess3: "",
    SpecialAccess4: ""
};
ac.templateFilter = {
    search: ""
};
ac.contentIsLoading = ko.observable(false);
ac.AccessColumns = ko.observableArray([{ headerTemplate: "<center><input type='checkbox' class='deletecheckall' onclick=\"ac.checkDeleteData(this, 'deleteall', 'all')\"/></center>", attributes: { style: "text-align: center;" }, width: 40, template: function template(d) {
        return ["<input type='checkbox' class='deletecheck' idcheck='" + d._id + "' onclick=\"ac.checkDeleteData(this, 'delete')\" />"].join(" ");
    } }, {
    field: "_id",
    title: "ID"
}, {
    field: "title",
    title: "Title"
}, {
    field: "group1",
    title: "Group 1"
}, {
    field: "group2",
    title: "Group 2"
}, {
    field: "group3",
    title: "Group 3"
}, {
    field: "enable",
    title: "Enable"
}, {
    field: "specialaccess1",
    title: "Special Access 1"
}, {
    field: "specialaccess2",
    title: "Special Access 2"
}, {
    field: "specialaccess3",
    title: "Special Access 3"
}, {
    field: "specialaccess4",
    title: "Special Access 4"
}, {
    headerTemplate: "<center>Action</center>", width: 100,
    template: function template(d) {
        return ["<button class='btn btn-sm btn-warning' onclick='ac.editData(\"" + d._id + "\")'><span class='fa fa-pencil'></span></button>"].join(" ");
    }
}]);

ac.filter = ko.mapping.fromJS(ac.templateFilter);
ac.config = ko.mapping.fromJS(ac.templateAccess);
ac.selectedTableID = ko.observable("");
ac.tempCheckIdDelete = ko.observableArray([]);
ac.isNew = ko.observable(false);

ac.checkDeleteData = function (elem, e) {
    if (e === 'delete') {
        if ($(elem).prop('checked') === true) ac.tempCheckIdDelete.push($(elem).attr('idcheck'));else ac.tempCheckIdDelete.remove(function (item) {
            return item === $(elem).attr('idcheck');
        });
    }
    if (e === 'deleteall') {
        if ($(elem).prop('checked') === true) {
            $('.deletecheck').each(function (index) {
                $(this).prop("checked", true);
                ac.tempCheckIdDelete.push($(this).attr('idcheck'));
            });
        } else {
            (function () {
                var idtemp = '';
                $('.deletecheck').each(function (index) {
                    $(this).prop("checked", false);
                    idtemp = $(this).attr('idcheck');
                    ac.tempCheckIdDelete.remove(function (item) {
                        return item === idtemp;
                    });
                });
            })();
        }
    }
};

ac.newData = function () {
    ac.isNew(true);
    $('#modalUpdate').modal('show');
    ko.mapping.fromJS(ac.templateAccess, ac.config);
};

ac.editData = function (id) {
    ac.isNew(false);
    toolkit.ajaxPost(viewModel.appName + 'administration/editaccess', { _id: id }, function (res) {
        if (!toolkit.isFine(res)) {
            return;
        }

        $('#modalUpdate').modal('show');
        ko.mapping.fromJS(res.data, ac.config);
    }, function (err) {
        toolkit.showError(err.responseText);
    }, {
        timeout: 5000
    });
};

ac.saveChanges = function () {
    if (!toolkit.isFormValid(".form-access")) {
        return;
    }
    toolkit.ajaxPost(viewModel.appName + 'administration/saveaccess', ko.mapping.toJS(ac.config), function (res) {
        if (!toolkit.isFine(res)) {
            return;
        }

        $('#modalUpdate').modal('hide');
        ac.refreshDataBrowser();
    }, function (err) {
        toolkit.showError(err.responseText);
    }, {
        timeout: 5000
    });
};

ac.refreshDataBrowser = function () {
    ac.contentIsLoading(true);
    $('.grid-access').data('kendoGrid').dataSource.read();
    ac.tempCheckIdDelete([]);
    ko.mapping.fromJS(ac.templateAccess, ac.config);
};

ac.deleteaccess = function () {
    if (ac.tempCheckIdDelete().length === 0) {
        swal({
            title: "",
            text: 'You havent choose any access to delete',
            type: "warning",
            confirmButtonColor: "#DD6B55",
            confirmButtonText: "OK",
            closeOnConfirm: true
        });
    } else {
        swal({
            title: "Are you sure?",
            text: 'Data access(s) ' + ac.tempCheckIdDelete().toString() + ' will be deleted',
            type: "warning",
            showCancelButton: true,
            confirmButtonColor: "#DD6B55",
            confirmButtonText: "Delete",
            closeOnConfirm: true
        }, function () {
            setTimeout(function () {
                toolkit.ajaxPost(viewModel.appName + "/administration/deleteaccess", { _id: ac.tempCheckIdDelete() }, function (res) {
                    if (!toolkit.isFine(res)) {
                        return;
                    }
                    ac.refreshDataBrowser();
                    swal({ title: "Data access(s) successfully deleted", type: "success" });
                });
            }, 1000);
        });
    }
};

ac.generateGrid = function () {
    $(".grid-access").html("");
    $('.grid-access').kendoGrid({
        dataSource: {
            transport: {
                read: {
                    url: "/administration/getaccess",
                    dataType: "json",
                    data: ko.mapping.toJS(ac.filter),
                    type: "POST",
                    success: function success(data) {
                        $(".grid-access>.k-grid-content-locked").css("height", $(".grid-access").data("kendoGrid").table.height());
                    }
                }
            },
            schema: {
                data: function data(res) {
                    ac.selectedTableID("show");
                    ac.contentIsLoading(false);
                    return res.data.Datas;
                },
                total: "data.total"
            },

            pageSize: 10,
            serverPaging: true, // enable server paging
            serverSorting: true
        },
        // selectable: "multiple, row",
        // change: ac.selectGridAccess,
        resizable: true,
        scrollable: true,
        // sortable: true,
        // filterable: true,
        pageable: {
            refresh: false,
            pageSizes: 10,
            buttonCount: 5
        },
        columns: ac.AccessColumns()
    });
};

$(function () {
    ac.generateGrid();
    $("#modalUpdate").insertAfter("body");
});