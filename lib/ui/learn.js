import { clearNode, el } from "./components.js";

const LESSONS = [
  {
    title: "Passes réussies",
    what: "Le nombre de passes qui arrivent bien à un coéquipier.",
    why: "Si tu gardes le ballon proprement, ton équipe attaque mieux.",
    forPosition: "Milieux, latéraux, défenseurs qui relancent.",
    example:
      "Si tu as 80% de passes réussies, ça veut dire qu'environ 8 passes sur 10 arrivent bien.",
  },
  {
    title: "Duels gagnés",
    what: "Les face-à-face où tu récupères ou protèges le ballon.",
    why: "Gagner ses duels, c'est aider l'équipe à reprendre la main.",
    forPosition: "Défenseurs, milieux récupérateurs, attaquants au pressing.",
    example: "7 duels gagnés sur 10, c'est une bonne présence physique.",
  },
  {
    title: "Ballons perdus",
    what: "Les actions où ton équipe perd le ballon après ton geste.",
    why: "Moins de pertes = moins de contre-attaques dangereuses.",
    forPosition: "Tous les postes.",
    example: "Si tu perds 3 ballons au lieu de 8, ton équipe souffle mieux.",
  },
  {
    title: "Interceptions",
    what: "Quand tu lis la passe adverse et coupes la trajectoire.",
    why: "Tu empêches l'adversaire de progresser et tu récupères vite.",
    forPosition: "Défenseurs et milieux défensifs.",
    example: "Une interception bien placée peut lancer un contre direct.",
  },
  {
    title: "Stats par 90 minutes",
    what: "Une version des stats ramenée à un match complet.",
    why: "Ça compare plus juste les joueurs qui n'ont pas joué pareil.",
    forPosition: "Tous les postes, surtout pour comparer des remplaçants et titulaires.",
    example: "1.5 tirs/90 veut dire en moyenne 1 à 2 tirs par match complet.",
  },
];

export function renderLearnView(target) {
  clearNode(target);

  const page = el("section", { className: "page-card" });
  page.append(el("h2", { text: "Tutoriels et glossaire" }));
  page.append(
    el("p", {
      className: "muted",
      text: "Comprends les mots des stats avec des exemples simples de coach.",
    })
  );

  const grid = el("div", { className: "grid-cards" });
  LESSONS.forEach((lesson) => {
    const card = el("article", { className: "learn-card" });
    card.append(el("h3", { text: lesson.title }));

    card.append(el("h4", { text: "C'est quoi ?" }));
    card.append(el("p", { text: lesson.what }));

    card.append(el("h4", { text: "Pourquoi ça compte ?" }));
    card.append(el("p", { text: lesson.why }));

    card.append(el("h4", { text: "Pour quel poste ?" }));
    card.append(el("p", { text: lesson.forPosition }));

    card.append(el("h4", { text: "Petit exemple" }));
    card.append(el("p", { text: lesson.example }));
    grid.append(card);
  });

  page.append(grid);
  target.append(page);
}
