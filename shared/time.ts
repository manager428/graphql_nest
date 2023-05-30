export const getFormatDate = (
  date: string | Date,
  format?: Intl.DateTimeFormatOptions,
  locale: string = 'en-US',
) =>
  new Intl.DateTimeFormat(locale, {
    ...format,
  }).format(new Date(date));

export const startOfDay = (
  date: string | Date,
  format: Intl.DateTimeFormatOptions,
  locale: string = 'en-US',
  formatForPostgresDB: boolean = false,
) => {
  const formattedDate = new Intl.DateTimeFormat(locale, {
    ...format,
  }).format(new Date(date).setUTCHours(0, 0, 0, 0));

  /**
   * Postgres DB requires the date format to be like yyyy-mm-dd and Intl returns dd/mm/yyyy
   */
  if (formatForPostgresDB) {
    const [month, day, year] = formattedDate.split('/');

    return `'${year}-${month}-${day}'::date`;
  }

  return formattedDate;
};

export const endOfDay = (
  date: string | Date,
  format: Intl.DateTimeFormatOptions,
  locale: string = 'en-US',
  formatForPostgresDB: boolean = false,
) => {
  const formattedDate = new Intl.DateTimeFormat(locale, {
    ...format,
  }).format(new Date(date).setUTCHours(24, 0, 0, 0));

  /**
   * Postgres DB requires the date format to be like yyyy-mm-dd and Intl returns dd/mm/yyyy
   */
  if (formatForPostgresDB) {
    const [month, day, year] = formattedDate.split('/');
    return `'${year}-${month}-${day}'::date`;
  }

  return formattedDate;
};
