import { Injectable } from '@nestjs/common';
import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import * as fs from 'fs';

@Injectable()
export class EmailService {

    private client;

    constructor() {

        const credential = new ClientSecretCredential( process.env.MS_TENANT_ID! , process.env.MS_CLIENT_ID!, process.env.MS_CLIENT_SECRET!);

         const authProvider = {
            getAccessToken: async () => {
                const token = await credential.getToken("https://graph.microsoft.com/.default");
                return token.token;
            }
        };

        this.client = Client.initWithMiddleware({ authProvider });
    }

    async sendCsvEmail(filePath: string, fileName: string, Message: string) {

        const fileContent = fs.readFileSync(filePath).toString("base64");

        const message = {
            message: {
                subject: "Export CSV " + fileName,
                body: {
                    contentType: "Text",
                    content: Message
                },
                toRecipients: [
                    {
                        emailAddress: {
                        address: process.env.DESTINATAIRE_MAIL
                        }
                    }
                ],
                ccRecipients: [ 
                    {
                        emailAddress: {
                            address: "dev@spmservices.fr"
                        }
                    }
                ],
                attachments: [
                    {
                        "@odata.type": "#microsoft.graph.fileAttachment",
                        name: fileName,
                        contentType: "text/csv",
                        contentBytes: fileContent
                    }
                ]
            }
        };

        await this.client
        .api(`/users/${process.env.MS_EMAIL_SENDER}/sendMail`)
        .post(message);
    }

    async sendMultiCsvEmail(
        attachments: { filePath: string, fileName: string }[],
        Subject: string,
        Message: string
    ) {

        const formattedAttachments = attachments.map(file => {
            const fileContent = fs.readFileSync(file.filePath).toString("base64");

            return {
                "@odata.type": "#microsoft.graph.fileAttachment",
                name: file.fileName,
                contentType: "text/csv",
                contentBytes: fileContent
            };
        });

        const message = {
            message: {
                subject: Subject,
                body: {
                    contentType: "Text",
                    content: Message
                },
                toRecipients: [
                    {
                        emailAddress: {
                            address: process.env.DESTINATAIRE_MAIL
                        }
                    }
                ],
                ccRecipients: [
                    {
                        emailAddress: {
                            address: "dev@spmservices.fr"
                        }
                    }
                ],
                attachments: formattedAttachments
            }
        };

        await this.client
            .api(`/users/${process.env.MS_EMAIL_SENDER}/sendMail`)
            .post(message);
    }

}
