# Fansbuy API findings

The rendered product page loads `https://fansbuy.com/apiv2/web/item` after page initialization. A browser-context fetch without parameters returns HTTP 200 and a JSON response with `code: 0`, but the response only contains general configuration data rather than the product price. The product page request therefore requires additional parameters or a request body that must be captured from the browser network session before writing a batch API client.

The direct HTML request returns HTTP 200 but does not contain rendered USD/RMB prices; price extraction from raw HTML alone is not reliable. The browser-rendered sample 7545217096 shows `$1.43` and `￥9.50`.


A browser console inspection found no useful global product state object. The price data is held inside the rendered Vue application and the item API request parameters are not exposed through the simple page globals. The raw HTTP batch crawler therefore confirmed 0/276 prices even though the browser-rendered sample is readable.
