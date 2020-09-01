// Copyright (C) 2020 Intel Corporation
//
// SPDX-License-Identifier: MIT

import './styles.scss';
import React, { useState } from 'react';
import { Row, Col } from 'antd/lib/grid';
import Icon from 'antd/lib/icon';
import Select, { OptionProps } from 'antd/lib/select';
import Checkbox, { CheckboxChangeEvent } from 'antd/lib/checkbox';
import Tooltip from 'antd/lib/tooltip';
import Tag from 'antd/lib/tag';
import notification from 'antd/lib/notification';
import Text from 'antd/lib/typography/Text';
import InputNumber from 'antd/lib/input-number';

import { Model, StringObject } from 'reducers/interfaces';
import Button from 'antd/lib/button';


function colorGenerator(): () => string {
    const values = [
        'magenta', 'green', 'geekblue',
        'orange', 'red', 'cyan',
        'blue', 'volcano', 'purple',
    ];

    let index = 0;

    return (): string => {
        const color = values[index++];
        if (index >= values.length) {
            index = 0;
        }

        return color;
    };
}

const nextColor = colorGenerator();

interface Props {
    withCleanup: boolean;
    models: Model[];
    task: any;
    runInference(task: any, model: Model, body: object): void;
}

function DetectorRunner(props: Props): JSX.Element {
    const {
        task,
        models,
        withCleanup,
        runInference,
    } = props;

    const [modelID, setModelID] = useState<string | null>(null);
    const [mapping, setMapping] = useState<StringObject>({});
    const [colors, setColors] = useState<StringObject>({});
    const [threshold, setThreshold] = useState<number>(0.5);
    const [distance, setDistance] = useState<number>(50);
    const [cleanup, setCleanup] = useState<boolean>(false);
    const [match, setMatch] = useState<{
        model: string | null;
        task: string | null;
    }>({
        model: null,
        task: null,
    });

    const model = models.filter((_model): boolean => _model.id === modelID)[0];
    const isDetector = model && model.type === 'detector';
    const isReId = model && model.type === 'reid';
    const buttonEnabled = model && (model.type === 'reid' || (
        model.type === 'detector' && !!Object.keys(mapping).length
    ));

    const modelLabels = (isDetector ? model.labels : [])
        .filter((_label: string): boolean => !(_label in mapping));
    const taskLabels = (isDetector && !!task
        ? task.labels.map((label: any): string => label.name) : []
    ).filter((_label: string): boolean => !Object.values(mapping).includes(_label));

    if (model && model.type !== 'reid' && !model.labels.length) {
        notification.warning({
            message: 'The selected model does not include any lables',
        });
    }

    function updateMatch(modelLabel: string | null, taskLabel: string | null): void {
        if (match.model && taskLabel) {
            const newmatch: { [index: string]: string } = {};
            const newcolor: { [index: string]: string } = {};
            newmatch[match.model] = taskLabel;
            newcolor[match.model] = nextColor();
            setColors({ ...colors, ...newcolor });
            setMapping({ ...mapping, ...newmatch });
            setMatch({ model: null, task: null });
            return;
        }

        if (match.task && modelLabel) {
            const newmatch: { [index: string]: string } = {};
            const newcolor: { [index: string]: string } = {};
            newmatch[modelLabel] = match.task;
            newcolor[modelLabel] = nextColor();
            setColors({ ...colors, ...newcolor });
            setMapping({ ...mapping, ...newmatch });
            setMatch({ model: null, task: null });
            return;
        }

        setMatch({
            model: modelLabel,
            task: taskLabel,
        });
    }

    function renderSelector(
        value: string,
        labels: string[],
        onChange: (label: string) => void,
    ): JSX.Element {
        return (
            <Select
                value={value}
                onChange={onChange}
                style={{ width: '100%' }}
                showSearch
                filterOption={(input: string, option: React.ReactElement<OptionProps>) => {
                    const { children } = option.props;
                    if (typeof (children) === 'string') {
                        return children.toLowerCase().includes(input.toLowerCase());
                    }

                    return false;
                }}
            >
                { labels.map((label: string): JSX.Element => (
                    <Select.Option key={label}>{label}</Select.Option>
                )) }
            </Select>
        );
    }

    return (
        <div className='cvat-run-model-content'>
            <Row type='flex' align='middle'>
                <Col span={4}>Model:</Col>
                <Col span={20}>
                    <Select
                        placeholder='Select a model'
                        style={{ width: '100%' }}
                        onChange={(_modelID: string): void => {
                            const newmodel = models
                                .filter((_model): boolean => _model.id === _modelID)[0];
                            const newcolors: StringObject = {};
                            const newmapping = task.labels
                                .reduce((acc: StringObject, label: any): StringObject => {
                                    if (newmodel.labels.includes(label.name)) {
                                        acc[label.name] = label.name;
                                        newcolors[label.name] = nextColor();
                                    }
                                    return acc;
                                }, {});

                            setMapping(newmapping);
                            setColors(newcolors);
                            setMatch({ model: null, task: null });
                            setModelID(_modelID);
                        }}
                    >
                        {models.map((_model: Model): JSX.Element => (
                            <Select.Option key={_model.id}>{_model.name}</Select.Option>
                        ))}
                    </Select>
                </Col>
            </Row>
            { isDetector && !!Object.keys(mapping).length && (
                Object.keys(mapping).map((modelLabel: string) => (
                    <Row key={modelLabel} type='flex' justify='start' align='middle'>
                        <Col offset={4}>
                            <Tag color={colors[modelLabel]}>{modelLabel}</Tag>
                        </Col>
                        <Col offset={1}>
                            <Tag color={colors[modelLabel]}>{mapping[modelLabel]}</Tag>
                        </Col>
                        <Col offset={1}>
                            <Tooltip title='Remove the mapped values' mouseLeaveDelay={0}>
                                <Icon
                                    className='cvat-danger-circle-icon'
                                    type='close-circle'
                                    onClick={(): void => {
                                        const newmapping = { ...mapping };
                                        delete newmapping[modelLabel];
                                        setMapping(newmapping);
                                    }}
                                />
                            </Tooltip>
                        </Col>
                    </Row>
                ))
            )}
            { isDetector && !!taskLabels.length && !!modelLabels.length && (
                <>
                    <Row type='flex' justify='start' align='middle'>
                        <Col span={10}>
                            {renderSelector(
                                match.model || '',
                                modelLabels,
                                (modelLabel: string) => updateMatch(modelLabel, null),
                            )}
                        </Col>
                        <Col span={10} offset={1}>
                            {renderSelector(
                                match.task || '',
                                taskLabels,
                                (taskLabel: string) => updateMatch(null, taskLabel),
                            )}
                        </Col>
                        <Col span={1} offset={1}>
                            <Tooltip title='Specify a label mapping between model labels and task labels' mouseLeaveDelay={0}>
                                <Icon className='cvat-info-circle-icon' type='question-circle' />
                            </Tooltip>
                        </Col>
                    </Row>
                </>
            )}
            { isDetector && withCleanup && (
                <div>
                    <Checkbox
                        checked={cleanup}
                        onChange={(e: CheckboxChangeEvent): void => setCleanup(e.target.checked)}
                    >
                        Clean old annotations
                    </Checkbox>
                </div>
            )}
            { isReId && (
                <div>
                    <Row type='flex' align='middle' justify='start'>
                        <Col>
                            <Text>Threshold</Text>
                        </Col>
                        <Col offset={1}>
                            <Tooltip title='Minimum similarity value for shapes that can be merged'>
                                <InputNumber
                                    min={0.01}
                                    step={0.01}
                                    max={1}
                                    value={threshold}
                                    onChange={(value: number | undefined) => {
                                        if (typeof (value) === 'number') {
                                            setThreshold(value);
                                        }
                                    }}
                                />
                            </Tooltip>
                        </Col>
                    </Row>
                    <Row type='flex' align='middle' justify='start'>
                        <Col>
                            <Text>Maximum distance</Text>
                        </Col>
                        <Col offset={1}>
                            <Tooltip title='Maximum distance between shapes that can be merged'>
                                <InputNumber
                                    placeholder='Threshold'
                                    min={1}
                                    value={distance}
                                    onChange={(value: number | undefined) => {
                                        if (typeof (value) === 'number') {
                                            setDistance(value);
                                        }
                                    }}
                                />
                            </Tooltip>
                        </Col>
                    </Row>
                </div>
            ) }
            <Row type='flex' align='middle' justify='end'>
                <Col>
                    <Button
                        disabled={!buttonEnabled}
                        type='primary'
                        onClick={() => {
                            runInference(
                                task,
                                model,
                                model.type === 'detector' ? { mapping, cleanup, threshold } : {
                                    threshold,
                                    max_distance: distance,
                                },
                            );
                        }}
                    >
                        Annotate
                    </Button>
                </Col>
            </Row>
        </div>
    );
}


export default React.memo(DetectorRunner, (prevProps: Props, nextProps: Props): boolean => (
    prevProps.task === nextProps.task
        && prevProps.runInference === nextProps.runInference
        && prevProps.models.length === nextProps.models.length
        && nextProps.models.reduce((acc: boolean, model: Model, index: number): boolean => (
            acc && model.id === prevProps.models[index].id
        ), true)
));