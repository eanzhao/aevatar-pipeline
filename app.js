function initReveals() {
  const revealItems = Array.from(document.querySelectorAll(".reveal"));
  if (revealItems.length === 0) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
        }
      }
    },
    {
      threshold: 0.14,
      rootMargin: "0px 0px -10% 0px",
    },
  );

  for (const item of revealItems) {
    observer.observe(item);
  }
}

function initSectionNav() {
  const navLinks = Array.from(
    document.querySelectorAll(".page-nav a[href^='#'], .section-nav a[href^='#']"),
  );

  if (navLinks.length === 0) {
    return;
  }

  const sections = navLinks
    .map((link) => {
      const id = link.getAttribute("href")?.slice(1) ?? "";
      return document.getElementById(id);
    })
    .filter(Boolean);

  if (sections.length === 0) {
    return;
  }

  const linkById = new Map(
    navLinks.map((link) => [link.getAttribute("href")?.slice(1), link]),
  );

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (!visible) {
        return;
      }

      const id = visible.target.id;
      for (const link of navLinks) {
        link.classList.toggle("is-active", link === linkById.get(id));
      }
    },
    {
      threshold: [0.2, 0.4, 0.65],
      rootMargin: "-10% 0px -45% 0px",
    },
  );

  for (const section of sections) {
    observer.observe(section);
  }
}

function parseBranchMap(value) {
  if (!value) {
    return [];
  }

  return value
    .split("|")
    .map((item) => {
      const [label, target] = item.split(":");
      return {
        label: (label ?? "").trim(),
        target: (target ?? "").trim(),
      };
    })
    .filter((item) => item.label && item.target);
}

function collectMarketingPhases() {
  const phaseSections = Array.from(document.querySelectorAll("[data-phase-section]"));
  if (phaseSections.length === 0) {
    return [];
  }

  const phases = phaseSections.map((section, phaseIndex) => {
    const title = section.querySelector("h2")?.textContent?.trim() ?? `Phase ${phaseIndex + 1}`;
    const kicker =
      section.querySelector(".section-kicker")?.textContent?.trim() ?? `Phase ${phaseIndex + 1}`;

    const steps = Array.from(section.querySelectorAll(".step-card")).map((card) => {
      const chips = Array.from(card.querySelectorAll(".chip")).map(
        (chip) => chip.textContent?.trim() ?? "",
      );

      return {
        number: card.querySelector(".step-no")?.textContent?.trim() ?? "",
        id: card.querySelector(".step-head strong")?.textContent?.trim() ?? "",
        type: chips[0] ?? "",
        role: chips[1] ?? "",
        description: card.querySelector("p")?.textContent?.trim() ?? "",
        phaseId: section.id,
        branches: parseBranchMap(card.dataset.branches),
        explicitNext: card.dataset.next?.trim() ?? "",
      };
    });

    return {
      id: section.id,
      section,
      title,
      kicker,
      steps,
    };
  });

  const allSteps = phases.flatMap((phase) => phase.steps);
  const stepIndexById = new Map(allSteps.map((step, index) => [step.id, index]));

  allSteps.forEach((step, index) => {
    const defaultNext = allSteps[index + 1]?.id ?? "";
    step.next = step.explicitNext || (step.branches.length === 0 ? defaultNext : "");

    if (step.next) {
      const targetIndex = stepIndexById.get(step.next);
      step.isCrossPhase =
        typeof targetIndex === "number" && allSteps[targetIndex].phaseId !== step.phaseId;
    } else {
      step.isCrossPhase = false;
    }

    step.branchTargetsCrossPhase = step.branches.some((branch) => {
      const targetIndex = stepIndexById.get(branch.target);
      return typeof targetIndex === "number" && allSteps[targetIndex].phaseId !== step.phaseId;
    });
  });

  return phases;
}

function createNode(tagName, className, text) {
  const node = document.createElement(tagName);
  if (className) {
    node.className = className;
  }
  if (typeof text === "string") {
    node.textContent = text;
  }
  return node;
}

function renderPhaseGraph(container, phase) {
  if (!container || phase.steps.length === 0) {
    return;
  }

  container.innerHTML = "";

  const phaseCard = createNode("section", "graph-phase");

  const phaseHead = createNode("header", "graph-phase-head");
  const headCopy = createNode("div");
  headCopy.append(
    createNode("p", "graph-phase-kicker", phase.kicker),
    createNode("h3", "", phase.title),
  );
  phaseHead.append(headCopy, createNode("span", "graph-phase-count", `${phase.steps.length} steps`));

  const lane = createNode("ol", "graph-lane");

  for (const step of phase.steps) {
    const node = createNode("li", "graph-node");
    node.tabIndex = 0;
    if (step.type === "conditional") {
      node.classList.add("is-conditional");
    }
    if (step.isCrossPhase || step.branchTargetsCrossPhase) {
      node.classList.add("is-cross-phase");
    }

    const nodeHead = createNode("div", "graph-node-head");
    nodeHead.append(createNode("span", "graph-node-no", step.number));

    const label = createNode("div", "graph-node-label");
    label.append(createNode("strong", "", step.id));

    const meta = createNode("div", "graph-node-meta");
    if (step.type) {
      meta.append(createNode("span", "graph-node-type", step.type));
    }
    if (step.role) {
      meta.append(createNode("span", "graph-node-role", step.role));
    }
    label.append(meta);
    nodeHead.append(label);

    const links = createNode("div", "graph-node-links");
    if (step.branches.length > 0) {
      links.classList.add("is-branch-grid");

      for (const branch of step.branches) {
        const branchBox = createNode(
          "div",
          step.branchTargetsCrossPhase ? "graph-branch-box is-cross-phase" : "graph-branch-box",
        );
        const branchClass = step.branchTargetsCrossPhase
          ? "graph-node-link-label is-cross"
          : "graph-node-link-label is-branch";
        branchBox.append(
          createNode("span", branchClass, branch.label),
          createNode("code", "", branch.target),
        );
        links.append(branchBox);
      }
    } else if (step.next) {
      const link = createNode("div", "graph-node-link");
      const labelClass = step.isCrossPhase
        ? "graph-node-link-label is-cross"
        : "graph-node-link-label is-next";
      link.append(
        createNode("span", labelClass, step.isCrossPhase ? "jump" : "next"),
        createNode("code", "", step.next),
      );
      links.append(link);
    }

    node.append(nodeHead, links);

    if (step.description) {
      node.append(createNode("div", "graph-node-tooltip", step.description));
    }

    lane.append(node);
  }

  phaseCard.append(phaseHead, lane);
  container.append(phaseCard);
}

function buildPhaseYamlFallback(phase) {
  const lines = [
    "# Fallback structural view",
    "",
    "steps:",
  ];

  lines.push(`  # ${phase.kicker} - ${phase.title}`);
  for (const step of phase.steps) {
    lines.push(`  - id: ${step.id}`);
    lines.push(`    type: ${step.type}`);
    if (step.role) {
      lines.push(`    role: ${step.role}`);
    }
    if (step.branches.length > 0) {
      lines.push("    branches:");
      for (const branch of step.branches) {
        lines.push(`      ${branch.label}: ${branch.target}`);
      }
    }
    if (step.explicitNext) {
      lines.push(`    next: ${step.explicitNext}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function extractRawStepBlocks(yamlText) {
  const blocks = new Map();
  const lines = yamlText.split("\n");
  let inSteps = false;
  let currentId = "";
  let currentLines = [];

  const flush = () => {
    if (!currentId || currentLines.length === 0) {
      return;
    }
    blocks.set(currentId, currentLines.join("\n").replace(/\n+$/, ""));
  };

  for (const line of lines) {
    if (!inSteps) {
      if (line.trim() === "steps:") {
        inSteps = true;
      }
      continue;
    }

    const match = line.match(/^  - id:\s*([^\s]+)\s*$/);
    if (match) {
      flush();
      currentId = match[1];
      currentLines = [line];
      continue;
    }

    if (!currentId) {
      continue;
    }

    currentLines.push(line);
  }

  flush();
  return blocks;
}

function buildPhaseRawYaml(phase, rawStepBlocks) {
  const lines = [`# ${phase.kicker} - ${phase.title}`, "", "steps:"];

  for (const step of phase.steps) {
    const rawBlock = rawStepBlocks.get(step.id);
    if (rawBlock) {
      lines.push(rawBlock, "");
    }
  }

  return lines.join("\n").replace(/\n+$/, "");
}

function hideMarketingTimelines(phases) {
  for (const phase of phases) {
    const timeline = phase.section.querySelector(".step-timeline");
    if (timeline) {
      timeline.hidden = true;
      timeline.setAttribute("aria-hidden", "true");
    }
  }
}

async function initMarketingDemoArtifacts() {
  const phaseSections = document.querySelectorAll("[data-phase-section]");
  if (phaseSections.length === 0) {
    return;
  }

  const phases = collectMarketingPhases();
  if (phases.length === 0) {
    return;
  }

  hideMarketingTimelines(phases);

  for (const phase of phases) {
    const graphContainer = phase.section.querySelector("[data-phase-graph]");
    if (graphContainer) {
      renderPhaseGraph(graphContainer, phase);
    }
  }

  let rawStepBlocks = null;

  try {
    const response = await fetch("./marketing_campaign_orchestrator.yaml");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    rawStepBlocks = extractRawStepBlocks(await response.text());
  } catch (error) {
    rawStepBlocks = null;
  }

  for (const phase of phases) {
    const yamlContainer = phase.section.querySelector("[data-phase-yaml]");

    if (!yamlContainer) {
      continue;
    }

    if (rawStepBlocks && rawStepBlocks.size > 0) {
      yamlContainer.textContent = buildPhaseRawYaml(phase, rawStepBlocks);
    } else {
      yamlContainer.textContent = buildPhaseYamlFallback(phase);
      yamlContainer.dataset.fallback = "true";
    }
  }
}

initReveals();
initSectionNav();
initMarketingDemoArtifacts();
