"use strict"

var app = new Vue({
  el: "#main",
  data: {
    // workbook information about the target spreadsheet
    workbook: {
      // spreadsheet ID
      id: "10PTA6JLBXP0g8U8CdOAE2SUFN6WKZTdmf5hYQ9XZhpE",
      // The SheetID for the workbook's sheets
      // See http://damolab.blogspot.com/2011/03/od6-and-finding-other-worksheet-ids.html
      // This can be a string OR the numbered position of the tab on the
      // workbook starting with 1 as the left most tab... yeah it's crazy
      sheets: {
        pictures: 'od6' // default 1st sheet
      }
    },
    search: '',
    filter: [],
    spreadsheet: {},
    cacheLifeTime: 5000, //hours*60*60*1000
  },

  /**
   * On creation get data
   */
  created: function () {
    this.getData();
  },

  methods: {
    /**
     * for each workbook.sheets get data
     */
    getData: function () {
      for ( var i in this.workbook.sheets ) {
        var sheetID = this.workbook.sheets[i];
        if ( ! this.getCache( sheetID )) {
          this.fetchData( this.workbook.id, sheetID );
        }
      }
    },
    /**
     * Capture data from spreadsheet
     * @param  {string} id    The workbook id
     * @param  {int} sheetID the sheetID or 1 indexed position of the sheet's tab
     * @return {[type]}    sends response to setData and putCache
     * @TODO error handling
     */
    fetchData: function ( id, sheetID ) {
      var xhr = new XMLHttpRequest(),
          self = this,
          url = 'https://spreadsheets.google.com/feeds/list/' + id +  '/1/public/values?alt=json';
      xhr.open('GET', url )
      xhr.onload = function() {
        console.log('data loaded from xhr: ', sheetID);
        self.setData( xhr.responseText, sheetID );
        self.putCache( xhr.responseText, sheetID );
      }
      xhr.send(null)
    },
    /**
     * Sets the data into the spreadsheet object
     * @param  {string} data  The unparsed JSON string
     * @param  {string} sheetID the string reference for the workbook sheet
     */
    setData: function ( data, sheetID) {
      this.$set(this.spreadsheet, sheetID, JSON.parse( data ))
    },
    /**
     * Puts data in the localStorage
     * @param  {string} data  unparsed JSON string of data
     * @param  {string} sheetID the string reference for the workbook sheet
     */
    putCache: function ( data, sheetID ) {
      window.localStorage.setItem( sheetID , data );
      console.log('data cached');
    },
    /**
     * grabs only fresh data from the localStorage
     * @param  {string} sheetID the string reference for the workbook sheet
     * @return {bool} If data is pulled from cache returns true otherwise false
     */
    getCache: function ( sheetID ) {
      if ( this.cacheIsFresh() && window.localStorage.getItem( sheetID )  ) {
        this.setData( window.localStorage.getItem( sheetID ), sheetID )
        console.log('data loaded from cache:', sheetID);
        return true;
      }

      return false;

    },
    /**
     * Tests if the cache is fresh and resets the timer if not
     * @return {bool} if the cacheLifeTime is expired return false
     */
    cacheIsFresh: function () {
      var now = new Date().getTime();
      var setupTime = localStorage.getItem('setupTime');
      if (setupTime == null) {
          localStorage.setItem('setupTime', now);
          return false; // cache is NOT fresh
      } else {
          if(now - setupTime > this.cacheLifeTime) {
              localStorage.clear()
              localStorage.setItem('setupTime', now);
              console.log('cache reset');
              return false; // cache is NOT fresh
          }
          return true; // cache is fresh
      }
    },
    /**
     * strips the http and www from a url
     * @param  {string} url a full URL for website
     * @return {string}     a url without the http and www
     * @TODO gracefull fail if url is null
     */
    stripHTTP: function ( url ) {
      var regex = new RegExp('(https?://(?:www.)?)','gi');
      return url.replace( regex, '' )
    },
    /**
     * Removes the trailing slash from a string
     * @param  {string} str string ready to have it's slash removed
     * @return {return}     string, now without a slash
     * @TODO gracefull fail if str is null
     */
    stripSlash: function ( str ) {
      return str.replace(/\/$/, "");
    },
    /**
     * Makes a URL pretty to look at
     * @param  {string} url a website url
     * @return {string}     a now pretty to look at url
     */
    prettyLink: function ( url ) {
      return this.stripSlash( this.stripHTTP( url ) );
    },
    /**
     * Loops through Google Spreadsheet data and returns array of objects
     * constructed from callback
     * @param  {string} sheetID the string reference for the workbook sheet
     * @param  {function} action  a function which passes row data and vue object
     * @return {array}         array of row data, false if sheetID doesn't exist
     */
    gsxRowObject: function ( sheetID, action ) {
      if ( this.spreadsheet[sheetID] === undefined ) return false;
      var out  = [],
          rows = this.spreadsheet[sheetID].feed.entry,
          self = this;

      for (var i = 0; i < rows.length; i++) {
        var rowObj = action( rows[i], self );
        if (rowObj) out.push( rowObj );
      }

      return out;
    },
    /**
     * Gathers Google Spreadsheet cell data for a particular column
     * @param  {object} row data row from Google Spreadsheet object
     * @param  {string} col name of spreadsheet column to fetch
     * @return {string}     returns cell data, null if cell contains no data
     */
    gsxGetCol: function ( row, col ) {
      var cell = row['gsx$' + col];
      return ( cell && cell.$t ) ? cell.$t : null ;
    },
  },
  computed: {
    /**
     * Generates an edit link to the Google Spreadsheet
     * @return {string} url to spreadsheet
     */
    workbookEditURL: function () {
      return 'https://docs.google.com/spreadsheets/d/' + this.workbook.id + '/edit';
    },
    /**
     * Creates a cleaned up array of row data objects
     * from the books sheets data
     * the string passed into gsxGetCol corrisponds to the column header
     * on the spreadsheet, lower case and without spaces
     * @return {array} array of objects
     */
    pictures : function () {
      return this.gsxRowObject( this.workbook.sheets.pictures , function (r,self) {
        var link = self.gsxGetCol( r, 'source' );
        var status = self.gsxGetCol( r, 'status');

        if ( !link || 400 < status || 'FALSE' === link) return false;

        return {
          link: link,
          name: self.gsxGetCol( r, 'item' )
        }
      });
    },
  },
});