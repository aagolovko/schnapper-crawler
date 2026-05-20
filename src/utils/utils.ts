export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));



export const pad = (num: number, size: number) => {
    let numStr = num.toString();
    while (numStr.length < size) numStr = "0" + num;
    return num;
}
