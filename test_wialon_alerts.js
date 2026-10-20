
const WIALON_BASE = "https://hst-api.wialon.com/wialon/ajax.html";

async function wialonApiCall(svc, params, sid = null) {
  const url = new URL(WIALON_BASE);
  url.searchParams.append("svc", svc);
  url.searchParams.append("params", JSON.stringify(params));
  if (sid) url.searchParams.append("sid", sid);
  const response = await fetch(url.toString(), { method: "POST" });
  return response.json();
}

const tokens = [
  "f5870843e01215ce6c07f1619bf78b4071524BDF6B8C581770EACC1DD9BF0348A0A4DF96",
  "f5870843e01215ce6c07f1619bf78b40AF6D4CA638FEDE2DFAE1B930E9641A5801E332E3"
];

async function test() {
  for (const token of tokens) {
    console.log(`Testing token: ${token.substring(0, 10)}...`);
    try {
      const loginData = await wialonApiCall("token/login", { token });
      if (loginData.error) {
        console.log(`  Login error: ${loginData.error}`);
        continue;
      }
      const sid = loginData.eid;
      
      const data = await wialonApiCall("core/search_items", {
        spec: { itemsType: "avl_resource", propName: "*", propValueMask: "*", sortType: "sys_name" },
        force: 1,
        flags: 0x0400 | 0x01,
        from: 0, to: 100
      }, sid);
      
      if (data.items) {
        let totalUnf = 0;
        for (const r of data.items) {
          if (r.unf) totalUnf += Object.keys(r.unf).length;
        }
        console.log(`  Total notifications (unf): ${totalUnf}`);
      }
      await wialonApiCall("core/logout", {}, sid);
    } catch (e) {
      console.log(`  Exception: ${e.message}`);
    }
  }
}

test();
