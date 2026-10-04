export const applyOptionalResource = (data, slice, result) => {
  const accessIssues = (data.accessIssues ?? []).filter((issue) => issue.slice !== slice);
  if (result.issue) accessIssues.push(result.issue);
  const optionalSlices = { ...data.dataCoverage?.optionalSlices,
    [slice]: result.issue ? 'unavailable' : 'available' };
  const pending = Object.values(optionalSlices).includes('loading');
  return {
    ...data,
    ...result.patch,
    latestMatchStartTime: Math.max(data.latestMatchStartTime ?? 0, result.patch?.latestMatchStartTime ?? 0) || null,
    accessIssues,
    partial: accessIssues.length > 0,
    status: accessIssues.length ? 'partial' : 'complete',
    dataCoverage: { ...data.dataCoverage, optionalSlices, complete: !pending && accessIssues.length === 0 },
  };
};
