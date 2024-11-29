export const DO_HEADLESS = false
// minimal pause between single search requests
export const MIN_TIME_BETWEEN_SEARCHES_MINUTES = 360 // 360
/* use next variables for debugging. The array containes keywords, which are
* only allowed to be used in searches.*/
export const FORCE_UPDATE = false
const STOP_CRAWLING = true
export const PAUSE_MS = 1000
export const DEBUG_SEARCH_KEYWORDS: string[] = [] // ['balken']
export const INITIAL_SEARCH_PAGE = 'https://www.kleinanzeigen.de/'


export const MAX_SEARCH_PAGES_FOR_KEYWORD = 1



// timeout when waiting for cookies or user registration banner
export const WAIT_FOR_SELECTOR = 5000

// used for debugging purposes. if the array is not empty,
// only keywords mentioned here are used for search.
export const ONLY_ALLOWED_KEYWORDS: string[] = []
