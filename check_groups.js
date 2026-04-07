const { createClient } = require("@supabase/supabase-js");
// I need the credentials from js/supabase-config.js
const fs = require("fs");
const content = fs.readFileSync(
  "c:/laragon/www/e-klinik - supabase/js/supabase-config.js",
  "utf8",
);
const urlMatch = content.match(/const SUPABASE_URL = "(.*)";/);
const keyMatch = content.match(/const SUPABASE_ANON_KEY = "(.*)";/);

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1]);
  supabase
    .from("kelompok")
    .select("*")
    .then(({ data, error }) => {
      if (error) {
        console.error(error);
      } else {
        console.log(JSON.stringify(data, null, 2));
      }
      process.exit();
    });
} else {
  console.error("Credentials not found");
}
