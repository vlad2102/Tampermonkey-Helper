// ==UserScript==
// @name         Tampermonkey-Helper
// @version      0.11.10
// @author       Vladislav
// @include      *
// @run-at       document-end
// @grant        GM_xmlhttpRequest
// @connect      *
// ==/UserScript==

(function() {
    /*=========================================================
                             SETTINGS
    =========================================================*/
    // Автоматически входить на сайтах
    const MAIN_LOGIN = 1; // 0 - выключено, 1 - включено
    const MAIN_EMAIL = '***';
    const MAIN_PASS = '***';

    // Автоматическое заполнение полей в корзине
    const SHOP_CART_AUTO_FILL_FORM = 1; // 0 - выключено, 1 - включено
    // Автоматическое заполнение полей в предзаказе
    const SHOP_PREORDER_AUTO_FILL_FORM = 1; // 0 - выключено, 1 - включено

    // Данные для автоматической подстановки в поле email
    const DATA_FOR_EMAIL_FORM = 'test@test.com';
    // Данные для автоматической подстановки в другие поля форм
    const DATA_FOR_OTHER_FORMS = 'Test';

    const INFO_URL = '/***/info';

    // Отображать информацию о сайтах в ЛК биллинга
    const SITES_INFO_IN_BILLING = 1; // 0 - выключено, 1 - включено

    // Помечать виджеты в админке красной рамкой
    const MARK_WIDGETS = 1; // 0 - нет, 1 - только виджеты отступ, 2 - все виджеты

    // Добавлять скрытый функционал в помощник
    const HACKS = 1; // 0 - выключено, 1 - включено
    /*=========================================================
                           END SETTINGS
    =========================================================*/

    class _Helper {

        static BUTTON_STYLE = `
            .__helper-button{
                background-color:#11aac3;
                opacity:.5;
                -webkit-border-radius:20px;
                display:inline-block;
                height:20px;
                width:20px;
                position:fixed;
                right:40px;
                top:100px;
                z-index:100;}
            .__helper-button:hover{
                opacity:.8;
                -webkit-border-radius:40px;
                height:40px;
                width:40px;
                right: 30px;
                top: 90px;}
            .__helper-button:active{
                top:92px;}`;

        static TABLE_STYLE = `
            .__helper-table{
                border-collapse:collapse;
                background-color:#fff;
                opacity:.6;}
            .__helper-on_the_right{
                position:fixed;
                right:50px;
                top:110px;
                z-index:99;}
            .__helper-over_preview{
                position:absolute;
                left:40px;
                top:20px;}
            .__helper-table:hover{
                opacity:1;}
            .__helper-td-1-column{
                border:1px solid black;
                text-align:right;
                padding-right:5px;
                padding-left:10px;}
            .__helper-td-2-column, .__helper-td-3-column{
                border:1px solid black;
                text-align:left;
                padding-left:10px;
                padding-right:10px;}`;

        constructor(options) {
            this.domain = options.domain;
            this.$parentElement = options.parentElement;
            this.position = options.position; // position in ['on_the_right', 'over_preview']
            this.information = options.information;

            this.INFORMATION = {
                'ttfb': {
                    'column': 3,
                    'title': 'TTFB:',
                    'value': ['(.) V', '(.) S'],
                },
                'mainPage': {
                    'column': 2,
                    'title': 'Main page:',
                    'value': [`<strong><a href="${this.domain}/main">(-) Open</a></strong>`],
                },
                'sourcePage': {
                    'column': 2,
                    'title': 'Source page:',
                    'visible': false,
                },
                'empty2': {
                    'column': 2,
                },
                'empty3': {
                    'column': 3,
                },
                'version': {
                    'column': 2,
                    'title': 'Version:',
                    'value': ['old'],
                },
            };

            this.$helperContainer = document.createElement('div');

            this.$helperStyle = document.createElement('style');
            this.$helperContainer.appendChild(this.$helperStyle);

            let tableVisible = true;
            if (this.position == 'on_the_right') {
                this._addButton();
                tableVisible = false;
            }
            this.__addTable(tableVisible);

            this.$parentElement.insertBefore(this.$helperContainer, this.$parentElement.firstChild);

            this.__addRowsInTableFromInformation(this.information);
            if (this.position == 'over_preview') getInfo(this);

            if (this.information.indexOf('sourcePage') > -1) this.addSourcePage();
        }

        _helperIncludeStyle(stylesName) {
            this.$helperStyle.innerHTML += _Helper[stylesName];
        }

        _addButton() {
            this.$button = document.createElement('a');
            this.$button.className = '__helper-button';
            this.$helperContainer.appendChild(this.$button);

            this._helperIncludeStyle('BUTTON_STYLE');

            this.__addButtonOnClickEvent();
        }

        __addButtonOnClickEvent() {
            let _HelperObj = this;

            this.$button.onclick = function() {
                if (_HelperObj.$tableContainer.getAttribute('style')) {
                    // Показываем помощник
                    _HelperObj.$tableContainer.style = '';
                    _HelperObj.__siteHelperOnOpenEvents();
                } else {
                    // Скрываем помощник
                    _HelperObj.$tableContainer.style = 'display: none;';
                }
            }
        }

        __siteHelperOnOpenEvents() {
            getInfo(this);
            mainLogin(this);
        }

        __addTable(visible) {
            this.$tableContainer = document.createElement('table');
            this.$tableContainer.className = `__helper-table __helper-${this.position}`;
            if (!visible) this.$tableContainer.style = 'display: none';
            this.$helperContainer.appendChild(this.$tableContainer);

            this.$table = document.createElement('tbody');
            this.$tableContainer.appendChild(this.$table);

            this._helperIncludeStyle('TABLE_STYLE');

            this.tableRowsName = [];
            this.$tableRowsLocation = [];
        }

        __addRowsInTableFromInformation() {
            for (let i = 0; i < this.information.length; i++) {
                let rowName = this.information[i];
                let rowColumn = this.INFORMATION[rowName]['column'];
                let rowTitle = (this.INFORMATION[rowName]['title']) ? this.INFORMATION[rowName]['title'] : '...';

                let rowValue = [];

                if (this.INFORMATION[rowName]['value']){
                    rowValue = this.INFORMATION[rowName]['value'];
                } else {
                    for (let j = 0; j < rowColumn - 1; j++) {
                        rowValue[j] = '...';
                    }
                }

                let rowVisible = (this.INFORMATION[rowName]['visible'] === false) ? this.INFORMATION[rowName]['visible'] : true;

                this.addRow(rowName, rowColumn, rowTitle, rowValue, rowVisible);
            }
        }

        addRow(name, column, title, value, visible) {
            let columns = [];
            columns[2] = `<td class="__helper-td-1-column">${title}</td><td class="__helper-td-2-column" colspan="2">${value[0]}</td>`;
            columns[3] = `<td class="__helper-td-1-column">${title}</td><td class="__helper-td-3-column">${value[0]}</td><td class="__helper-td-3-column">${value[1]}</td>`;

            let index = this.tableRowsName.push(name);
            index--;

            this.$tableRowsLocation[index] = document.createElement('tr');
            this.$tableRowsLocation[index].style = (visible) ? '' : 'display: none';
            this.$tableRowsLocation[index].innerHTML = columns[column];

            this.$table.appendChild(this.$tableRowsLocation[index]);
        }

        updateRowValue(rowName, value) {
            let index = this.tableRowsName.indexOf(rowName);

            if (this.INFORMATION[rowName]['column'] == 2) {
                this.$tableRowsLocation[index].querySelector('.__helper-td-2-column').innerHTML = value[0];
            } else if (this.INFORMATION[rowName]['column'] == 3) {
                this.$tableRowsLocation[index].querySelectorAll('.__helper-td-3-column')[0].innerHTML = value[0];
                this.$tableRowsLocation[index].querySelectorAll('.__helper-td-3-column')[1].innerHTML = value[1];
            }

            this.$tableRowsLocation[index].style = '';
        }

        pasteInfoInTable(siteInfo) {
            let info = [];

            if (this.position == 'on_the_right') {
                info = ['ttfb', 'empty2', 'empty2'];
            } else {
                info = ['empty2', 'empty2'];
            }

            for (let i = 0; i < info.length; i++) {
                this.updateRowValue(info[i], siteInfo[info[i]]);
            }
        }

        addSourcePage() {
            let text = '';

            try {
                let p = JSON.parse(document.querySelector('#s').innerHTML)[0][0].product_id;

                text = `<strong><a href="${this.domain}/d/${p}" >Open</a></strong>`;
            } catch (e) {};

            try {
                let p = /\d+/.exec(document.querySelectorAll('#p')[0].id)[0];

                text = `<strong><a href="${this.domain}/p/${p}" >Open</a></strong>`;
            } catch (e) {
                try {
                    let s = JSON.parse(document.querySelector('#b').innerHTML).sid;

                    text = `<strong><a href="${this.domain}/c/${s}" >Open</a></strong>`;
                } catch (e) {};
            };

            if (text) this.updateRowValue('sourcePage', [text]);
        }
    }

    class _Hacks {
        constructor(helperObj) {
            this.helperObj = helperObj;
            this.url = document.location.href;

            if (this.url.search(/.*/gm) > -1) this.deliveriesPage();

            if (document.location.pathname == '/index.php') this.logs();
        }

        addHackToHelper(hackName, hackValue) {
            this.helperObj.addRow(hackName, 2, '<strong style="color:red;">Hack</strong>:', [hackValue], true);
            this.helperObj.$button.style = 'background-color: #c3116d';
        }

        deliveriesPage() {
            let text = `<strong><a href="/***/delivery" >Доставки</a></strong>`;

            this.addHackToHelper('deliveriesPage', text);
        }

        logs() {
            let text = `<strong><a href="/logs" >Логи</a></strong>`;

            this.addHackToHelper('hackLogs', text);
        }
    }

    main();

    function main() {
        if (document.documentElement.innerHTML.indexOf('cms') > -1) {
            const _Form = new _Helper({
                'domain': window.location.origin,
                'parentElement': document.body,
                'position': 'on_the_right',
                'information': [
                    'ttfb',
                    'empty2',
                    'empty3',
                    'mainPage',
                    'sourcePage',
                ],
            })

            if (SHOP_CART_AUTO_FILL_FORM) setTimeout(fillShopCartForm, 3000);

            if (SHOP_PREORDER_AUTO_FILL_FORM) fillShopPreorderForm();

            if (MARK_WIDGETS > 0) markWidgets();

            if (HACKS) new _Hacks(_Form);
        }

        if (document.documentElement.innerHTML.indexOf('/core') > -1) {
            const formOld = new _Helper({
                'domain': window.location.origin,
                'parentElement': document.body,
                'position': 'on_the_right',
                'information': [
                    'version',
                    'mainPage',
                ],
            })
        }

        if (SITES_INFO_IN_BILLING && document.location.pathname == '/sites') {
            let $divs = document.querySelectorAll('.box');
            let formSitesInBilling = [];
            for (let i = 0; i < $divs.length; i++) {
                formSitesInBilling[i] = new _Helper({
                    'domain': $divs[i].querySelector('.title').href.slice(0, -1),
                    'parentElement': $divs[i].querySelector('.img'),
                    'position': 'over_preview',
                    'information': [
                        'ttfb',
                        'empty2',
                        'empty3',
                    ],
                })
            }
        }

        if (HACKS) {
            let locations = ['/sites', '/design'];

            if (locations.indexOf(document.location.pathname) > -1) {
                const formInB = new _Helper({
                    'domain': window.location.origin,
                    'parentElement': document.body,
                    'position': 'on_the_right',
                    'information': [],
                })

                new _Hacks(formInB);
            }
        }
    }

    function getInfo(obj) {
        GM_xmlhttpRequest({
            method: 'GET',
            url: `${obj.domain}${INFO_URL}`,
            onload: function(response) {
                try {
                    let info = JSON.parse(response.response);

                    let result = {}

                    result.empty2 = [getTextS(info.s)];
                    result.empty3 = [getTextR1(info.c1), getTextR2(info.c2)];

                    obj.pasteInfoInTable(result)
                } catch (e) {}
            }
        })

        function getTextS(s) {
            return `<strong><a href="https://${s.replace(/\D+/g,"")}.ru/">${s}</a></strong>`;
        }

        function getTextR1(r) {
            return `1-${r.replace(/^.*$/g, "$1")}`;
        }

        function getTextR2(r) {
            return `2-${r.replace(/^.*$/g, "$1")}`;
        }
    }

    function mainLogin(obj) {
        GM_xmlhttpRequest({
            method: 'GET',
            url: `${obj.domain}/main`,
            onload: function(response) {
                if (response.finalUrl != `${obj.domain}/main`) {
                    if (MAIN_LOGIN) {
                        GM_xmlhttpRequest({
                            method: 'POST',
                            url: `${obj.domain}/login`,
                            headers: {},
                            data: `login=${MAIN_EMAIL}&pass=${MAIN_PASS}`,
                            onload: function(response) {
                                if (response.finalUrl == `${obj.domain}/main`) {
                                    obj.updateRowValue('mainPage', [`<strong><a href="${obj.domain}/main">(+) Open</a></strong>`]);
                                };
                            }
                        })
                    }
                } else {
                    obj.updateRowValue('mainPage', [`<strong><a href="${obj.domain}/main">(+) Open</a></strong>`]);
                }
            }
        })
    }

    function fillShopCartForm() {
        try {
            document.querySelector('.submit').onmousedown = function () {
                let elements = document.querySelectorAll('.form');

                fillForm(elements);
            }
        } catch (e) {}
    }

    function fillShopPreorderForm() {
        try {
            document.querySelector('.preorder').onmousedown = function () {
                let elements = document.querySelectorAll('.form');

                fillForm(elements);
            }
        } catch (e) {}
    }

    function fillForm(elements) {
        for (let i = 0; i < elements.length; i++) {
            // Выпадающий список
            if (elements[i].querySelector('select')) continue;

            try {
                let input = elements[i].querySelector('input');

                switch (input.type) {
                    case 'email':
                        if (!input.value) input.value = DATA_FOR_EMAIL_FORM;
                        break;
                    case 'text':
                        if (!input.value) input.value = DATA_FOR_OTHER_FORMS;
                        break;
                    case 'checkbox':
                        input.checked = true;
                        break;
                }
            } catch (e) {}

            try {
                let textarea = elements[i].querySelector('textarea');
                if (!textarea.value) textarea.value = DATA_FOR_OTHER_FORMS;
            } catch (e) {}
        }
    }

    function markWidgets() {
        let markStyle = 'border: 1px solid red';

        let widgets = [];
        try {
            if (document.querySelectorAll('.container').length) {
                switch (MARK_WIDGETS) {
                    case 1:
                        widgets = document.querySelectorAll('.widget1');
                        break;
                    case 2:
                        widgets = document.querySelectorAll('.widget2');
                        break;
                }
            }

            for (let i = 0; i < widgets.length; i++) {
                widgets[i].style = markStyle;
            }
        } catch (e) {}
    }
})();