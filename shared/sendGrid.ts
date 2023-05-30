import sgMail, { MailDataRequired } from '@sendgrid/mail';
import { EmailTemplates } from './enums/EmailTemplates';
import { logError, logInfo } from './utils';

const logo_url = process.env.SENDGRID_HOST_URL;

export const sendPasswordResetEmail = async (
  to: string,
  firstName: string,
  lastName: string,
  tokenUrl: string,
) => {
  try {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

    const msg = {
      to: to,
      from: process.env.SEND_GRID_FROM_EMAIL!,
      templateId: EmailTemplates.ForgotPassword,
      dynamicTemplateData: {
        Staff_First_Name: firstName,
        Staff_Last_Name: lastName,
        Token_Url: tokenUrl,
        logo_url: logo_url,
      },
    } satisfies MailDataRequired;

    let sendResult = await sgMail.send(msg);

    logInfo(sendResult, 'Sendgrid returned ');

    if (![200, 202].includes(sendResult[0].statusCode)) {
      throw new Error(
        `Error occurred when trying to send forgot password email via Sendgrid, ${msg}}`,
      );
    }
  } catch (error) {
    logError(error);
    throw error;
  }
};

export const sendRegisterWelcomeEmail = async (
  toMail: string,
  firstName: string,
  get_started_link: string,
) => {
  try {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

    const msg = {
      to: toMail,
      from: process.env.SEND_GRID_FROM_EMAIL!,
      templateId: EmailTemplates.RegisterWelcomeEmail,
      dynamicTemplateData: {
        first_name: firstName,
        email: toMail,
        logo_url: logo_url,
        get_started_link: get_started_link,
      },
    } satisfies MailDataRequired;

    let sendResult = await sgMail.send(msg);

    logInfo(sendResult, 'Sendgrid returned ');

    if (![200, 202].includes(sendResult[0].statusCode)) {
      throw new Error(
        `Error occurred when trying to send welcome email via Sendgrid, ${msg}}`,
      );
    }
  } catch (error) {
    logError(error);
    throw error;
  }
};

export const createStaffAccountEmail = async (
  toMail: string,
  firstName: string,
  lastName: string,
  password: string,
  managerFirstName?: string,
) => {
  try {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

    const msg = {
      to: toMail,
      from: process.env.SEND_GRID_FROM_EMAIL!,
      templateId: EmailTemplates.CreateStaffAccount,
      dynamicTemplateData: {
        Manager_First_Name: managerFirstName || '',
        Staff_First_Name: firstName,
        Staff_Last_Name: lastName,
        Staff_Email: toMail,
        Staff_Password: password,
        logo_url: logo_url,
      },
    } satisfies MailDataRequired;

    let sendResult = await sgMail.send(msg);

    logInfo(sendResult, 'Sendgrid returned ');

    if (![200, 202].includes(sendResult[0].statusCode)) {
      throw new Error(
        `Error occurred when trying to send welcome email via Sendgrid, ${msg}}`,
      );
    }
  } catch (error) {
    logError(error);
    throw error;
  }
};
