import fs from "node:fs/promises";

const USERNAME = process.env.GITHUB_USERNAME || "PriyanshuAgarwal1407";
const TOKEN = process.env.GITHUB_TOKEN;
const README_PATH = "./README.md";
const START_MARKER = "<!-- REPO-LIST:START -->";
const END_MARKER = "<!-- REPO-LIST:END -->";
const MAX_REPOS = 6;

async function fetchLatestRepositories() {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": `${USERNAME}-profile-sync`,
  };

  if (TOKEN) {
    headers.Authorization = `Bearer ${TOKEN}`;
  }

  const response = await fetch(
    `https://api.github.com/users/${USERNAME}/repos?sort=pushed&direction=desc&per_page=30&type=owner`,
    { headers }
  );

  if (!response.ok) {
    throw new Error(`GitHub API returned ${response.status}: ${await response.text()}`);
  }

  const repos = await response.json();

  return repos
    .filter(
      (repo) =>
        !repo.fork &&
        !repo.archived &&
        repo.name.toLowerCase() !== USERNAME.toLowerCase()
    )
    .slice(0, MAX_REPOS);
}

function formatDate(isoDate) {
  const date = new Date(isoDate);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

function escapeCell(text) {
  return text.replace(/\|/g, "\\|").replace(/\r?\n|\r/g, " ").trim();
}

function buildMarkdownTable(repos) {
  const header = [
    "| Repository | Primary Language | Description | Last Pushed |",
    "| :--- | :--- | :--- | :--- |",
  ];

  if (repos.length === 0) {
    return [
      ...header,
      "| _No public repositories yet._ | — | — | — |",
    ].join("\n");
  }

  const rows = repos.map((repo) => {
    const name = `**[${repo.name}](${repo.html_url})**`;
    const lang = repo.language ? `\`${repo.language}\`` : "—";
    const desc = repo.description
      ? escapeCell(repo.description)
      : "—";
    const updated = formatDate(repo.pushed_at);
    return `| ${name} | ${lang} | ${desc} | ${updated} |`;
  });

  return [...header, ...rows].join("\n");
}

async function run() {
  const repos = await fetchLatestRepositories();
  const tableMarkdown = buildMarkdownTable(repos);
  const readmeContent = await fs.readFile(README_PATH, "utf8");

  const startIndex = readmeContent.indexOf(START_MARKER);
  const endIndex = readmeContent.indexOf(END_MARKER);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(`Could not locate ${START_MARKER} / ${END_MARKER} markers in ${README_PATH}`);
  }

  const updatedReadme =
    readmeContent.slice(0, startIndex + START_MARKER.length) +
    "\n" +
    tableMarkdown +
    "\n" +
    readmeContent.slice(endIndex);

  await fs.writeFile(README_PATH, updatedReadme, "utf8");
  console.log(`Synced ${repos.length} repositories into ${README_PATH}.`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
