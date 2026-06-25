import { localize } from '@deriv-com/translations';

// A simple variant of notify block matching friend's XML name 'btnotify'
window.Blockly.Blocks.btnotify = {
    init() {
        this.jsonInit({
            message0: localize('Notify {{ type }}: {{ message }}', { type: '%1', message: '%2' }),
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'NOTIFICATION_TYPE',
                    options: [
                        [localize('Success'), 'success'],
                        [localize('Info'), 'info'],
                        [localize('Warn'), 'warn'],
                        [localize('Error'), 'error'],
                    ],
                },
                {
                    type: 'input_value',
                    name: 'MESSAGE',
                    check: ['String', 'Number'],
                },
            ],
            previousStatement: null,
            nextStatement: null,
            colour: window.Blockly.Colours.Utility.colour,
            colourSecondary: window.Blockly.Colours.Utility.colourSecondary,
            colourTertiary: window.Blockly.Colours.Utility.colourTertiary,
        });
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.btnotify = block => {
    const type = block.getFieldValue('NOTIFICATION_TYPE') || 'info';
    const message =
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            'MESSAGE',
            window.Blockly.JavaScript.javascriptGenerator.ORDER_NONE
        ) || "''";
    return `Bot.notify('${type}', String(${message}));\n`;
};
