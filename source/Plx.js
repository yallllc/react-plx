import React, { Component } from 'react';
import PropTypes from 'prop-types';
import ScrollManager from './scroll-manager';

const DEFAULT_UNIT = 'px';
const DEFAULT_ANGLE_UNIT = 'deg';
const ANGLE_PROPERTIES = ['rotate', 'rotateX', 'rotateY', 'rotateZ'];

const TRANSFORM_MAP = {
  rotate: (value, unit: DEFAULT_ANGLE_UNIT) => `rotate(${ value }${ unit })`,
  rotateX: (value, unit: DEFAULT_ANGLE_UNIT) => `rotateX(${ value }${ unit })`,
  rotateY: (value, unit: DEFAULT_ANGLE_UNIT) => `rotateY(${ value }${ unit })`,
  rotateZ: (value, unit: DEFAULT_ANGLE_UNIT) => `rotateZ(${ value }${ unit })`,
  scale: value => `scale(${ value })`,
  scaleX: value => `scaleX(${ value })`,
  scaleY: value => `scaleY(${ value })`,
  scaleZ: value => `scaleZ(${ value })`,
  skew: (value, unit: DEFAULT_UNIT) => `skew(${ value }${ unit })`,
  skewX: (value, unit: DEFAULT_UNIT) => `skewX(${ value }${ unit })`,
  skewY: (value, unit: DEFAULT_UNIT) => `skewY(${ value }${ unit })`,
  skewZ: (value, unit: DEFAULT_UNIT) => `skewZ(${ value }${ unit })`,
  translateX: (value, unit: DEFAULT_UNIT) => `translateX(${ value }${ unit })`,
  translateY: (value, unit: DEFAULT_UNIT) => `translateY(${ value }${ unit })`,
  translateZ: (value, unit: DEFAULT_UNIT) => `translateZ(${ value }${ unit })`,
};

const ORDER_OF_TRANSFORMS = [
  'translateX',
  'translateY',
  'translateZ',
  'skew',
  'skewX',
  'skewY',
  'skewZ',
  'rotate',
  'rotateX',
  'rotateY',
  'rotateZ',
  'scale',
  'scaleX',
  'scaleY',
  'scaleZ',
];

export default class Plx extends Component {
  constructor(props) {
    super(props);

    const {
      interval,
    } = props;

    this.scrollManager = new ScrollManager(interval);
    this.handleScrollChange = this.handleScrollChange.bind(this);

    this.state = {
      hasReceivedScrollEvent: false,
      style: {},
    };
  }

  componentWillMount() {
    window.addEventListener('plx-scroll', this.handleScrollChange);
  }

  // TODO
  // componentWillReceiveProps(nextProps) {
  //
  // }

  componentWillUnmount() {
    window.removeEventListener('plx-scroll', this.handleScrollChange);

    this.scrollManager.destroy();
    this.scrollManager = null;

    this.scrollPosition = null;
  }

  getElementTop() {
    return this.element.getBoundingClientRect().top + this.scrollPosition;
  }

  getUnit(property, unit) {
    let propertyUnit = unit || DEFAULT_UNIT;

    if (ANGLE_PROPERTIES.indexOf(property) > -1) {
      propertyUnit = unit || DEFAULT_ANGLE_UNIT;
    }

    return propertyUnit;
  }

  parallax(scrollPosition, start, duration, startValue, endValue) {
    let min = startValue;
    let max = endValue;
    const invert = startValue > endValue;

    if (invert) {
      min = endValue;
      max = startValue;
    }

    let value = ((scrollPosition - start) / duration) * (max - min);

    if (invert) {
      value = max - value;
    } else {
      value += min;
    }

    if (value < min) {
      value = min;
    } else if (value > max) {
      value = max;
    }

    return value.toFixed(3);
  }

  handleScrollChange(e) {
    const {
      parallaxData,
    } = this.props;
    const {
      hasReceivedScrollEvent,
      style,
    } = this.state;
    const {
      scrollPosition,
    } = e.detail;


    this.scrollPosition = scrollPosition;

    const newState = {};
    const newStyle = {
      transform: {},
    };

    if (!hasReceivedScrollEvent) {
      newState.hasReceivedScrollEvent = true;
    }

    const appliedProperties = [];
    const segments = [];

    for (let i = 0; i < parallaxData.length; i++) {
      const {
        start,
        duration,
        offset,
        properties,
      } = parallaxData[i];

      const scrollOffset = offset || 0;

      const startPosition = (start === 'top' ? this.getElementTop() : start) + scrollOffset;
      const parallaxDuration = duration === 'height' ? this.element.offsetHeight : duration;
      const endPosition = startPosition + parallaxDuration;

      if (scrollPosition >= startPosition && scrollPosition <= endPosition) {
        properties.forEach((propertyData) => {
          const {
            startValue,
            endValue,
            property,
            unit,
          } = propertyData;
          appliedProperties.push(property);

          const propertyUnit = this.getUnit(property, unit);
          const value = this.parallax(
            scrollPosition,
            startPosition,
            parallaxDuration,
            startValue,
            endValue
          );
          const transformMethod = TRANSFORM_MAP[property];

          if (transformMethod) {
            // Transforms
            newStyle.transform[property] = transformMethod(value, propertyUnit);
          } else {
            // All other properties
            newStyle[property] = value;
          }
        });
      } else {
        segments.push({
          parallaxDuration,
          properties,
          startPosition,
        });
      }

      if (scrollPosition < startPosition) {
        break;
      }
    }

    segments.forEach(data => {
      const {
        properties,
        startPosition,
        parallaxDuration,
      } = data;

      properties.forEach((propertyData) => {
        const {
          startValue,
          endValue,
          property,
          unit,
        } = propertyData;

        // Skip propery that was changed for current segment
        if (appliedProperties.indexOf(property) > -1) {
          return;
        }

        const propertyUnit = this.getUnit(property, unit);
        const value = this.parallax(
          scrollPosition,
          startPosition,
          parallaxDuration,
          startValue,
          endValue
        );
        const transformMethod = TRANSFORM_MAP[property];

        if (transformMethod) {
          // Transforms
          newStyle.transform[property] = transformMethod(value, propertyUnit);
        } else {
          // All other properties
          newStyle[property] = value;
        }
      });
    });

    const transformsOrdered = [];

    ORDER_OF_TRANSFORMS.forEach(transformKey => {
      if (newStyle.transform[transformKey]) {
        transformsOrdered.push(newStyle.transform[transformKey]);
      }
    });

    newStyle.transform = transformsOrdered.join(' ');
    newStyle.WebkitTransform = newStyle.transform;
    newStyle.MozTransform = newStyle.transform;
    newStyle.OTransform = newStyle.transform;
    newStyle.msTransform = newStyle.transform;

    if (JSON.stringify(style) !== JSON.stringify(newStyle)) {
      newState.style = newStyle;
    }

    if (Object.keys(newState).length) {
      requestAnimationFrame(() => {
        this.setState(newState);
      });
    }
  }

  render() {
    const {
      className,
      children,
    } = this.props;
    const {
      hasReceivedScrollEvent,
      style,
    } = this.state;

    return (
      <div
        className={ `Plx ${ className }` }
        style={ {
          ...style,
          // TODO think more about how to solve this
          visibility: hasReceivedScrollEvent ? null : 'hidden',
        } }
        ref={ el => this.element = el }
      >
        { children }
      </div>
    );
  }
}

const propertiesItemType = PropTypes.shape({
  startValue: PropTypes.number.isRequired,
  endValue: PropTypes.number.isRequired,
  property: PropTypes.string.isRequired,
  unit: PropTypes.string,
});

const parallaxDataType = PropTypes.shape({
  start: PropTypes.oneOfType([
    PropTypes.oneOf(['top']),
    PropTypes.number,
  ]).isRequired,
  duration: PropTypes.oneOfType([
    PropTypes.oneOf(['height']),
    PropTypes.number,
  ]).isRequired,
  offset: PropTypes.number,
  properties: PropTypes.arrayOf(propertiesItemType).isRequired,
});


Plx.propTypes = {
  children: PropTypes.any,
  interval: PropTypes.number,
  className: PropTypes.string,
  parallaxData: PropTypes.arrayOf(parallaxDataType).isRequired,
};

Plx.defaultProps = {
  className: '',
  interval: 30,
};