export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export const searchPageNumber = (url: string) => {
    let searchPageNum = 1

    if (url == 'https://www.kleinanzeigen.de/') {
        // the page where the query is entered
        return 0
    } else if (!url.includes('seite:')) {
        // first search page
        return  1
    } else {
        let urlSplitted = url.split('/');
        searchPageNum = urlSplitted[4]?.split(':').at(1)
    }

    return searchPageNum
};

export const pad = (num, size) => {
    num = num.toString();
    while (num.length < size) num = "0" + num;
    return num;
}
