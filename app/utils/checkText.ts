import { userAccessMemory } from "../store";
import { showToast } from "@/app/components/ui-lib";

function formatDateTime(date: Date): string {
  const pad = (num: number): string => (num < 10 ? "0" + num : num.toString());

  let year: number = date.getFullYear(),
    month: string = pad(date.getMonth() + 1), // 月份是从0开始的
    day: string = pad(date.getDate()),
    hour: string = pad(date.getHours()),
    minute: string = pad(date.getMinutes()),
    second: string = pad(date.getSeconds());

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}
const checkdomain = () => {
  //验证是否是域名
  let doname =
    /^([\w-]+\.)+((com)|(net)|(org)|(gov\.cn)|(info)|(cc)|(com\.cn)|(net\.cn)|(org\.cn)|(name)|(biz)|(tv)|(cn)|(mobi)|(name)|(sh)|(ac)|   (io)|(tw)|(com\.tw)|(hk)|(com\.hk)|(ws)|(travel)|(us)|(tm)|(la)|(me\.uk)|(org\.uk)|(ltd\.uk)|(plc\.uk)|(in)|(eu)|(it)|(jp))$/;
  let flag_domain = doname.test(document.domain);
  if (!flag_domain) {
    //错误的域名
    return false;
  } else {
    return true;
  }
};
// const fileSearchBaseUrl = checkdomain()
//   ? ""
//   : `${location.protocol}//${location.hostname}`;
const fileSearchBaseUrl = "http://localhost:8080";
export async function checkText(
  text: string,
  zoomModel: string,
): Promise<boolean> {
  const chatPath = `${fileSearchBaseUrl}/checkText`;
  const result = await fetch(chatPath, {
    method: "post",
    headers: {
      "Content-Type": "application/json", // 确保设置了Content-Type
    },
    body: JSON.stringify({
      text: text,
      username: userAccessMemory.getState().username,
      time: formatDateTime(new Date()),
      zoomModel,
    }),
  })
    .then((res) => res.json())
    .then(({ data, message }: { data: boolean; message: string }) => {
      data && showToast(message);
      return !data;
    });

  return result;
}
