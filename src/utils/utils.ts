export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export const searchPageNumber = (url: string) => {
    if (url.includes('seite:')) {
        let urlSplitted = url.split('/');
        return Number(urlSplitted[4]?.split(':').at(1))
    } else {
        return 0
    }
};

export const pad = (num: number, size: number) => {
    let numStr = num.toString();
    while (numStr.length < size) numStr = "0" + num;
    return num;
}
