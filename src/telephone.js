export const normaliserNumeroSenegal = (telephone) => {
  let chiffres = String(telephone ?? "").replace(/\D/g, "");
  if (chiffres.startsWith("00")) chiffres = chiffres.slice(2);
  if (chiffres.startsWith("221")) chiffres = chiffres.slice(3);
  return `221${chiffres}`;
};
