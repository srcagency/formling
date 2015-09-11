'use strict';

var Promise = require('bluebird');
var assign = require('object-assign');
var debug = require('debug')('formling');

module.exports = {
	InputError: InputError,
	ValidationError : ValidationError,

	decorate: decorate,
};

function decorate( ctor, opts ){
	debug('%s.decorate', ctor.name);

	assign(ctor, {
		InputError: InputError,
		ValidationError: ValidationError,

		fields: Object.keys(opts.validators),
		validators: opts.validators,
	});

	assign(ctor.prototype, methods, {
		// just shortcuts
		fields: ctor.fields,
		validators: ctor.validators,
	});
}

var methods = {
	submit: function( data ){
		debug('%s.submit', this.constructor.name);

		return Promise
			.resolve(data)
			.bind(this)
			.then(this.fill)
			.tap(this.prepare)
			.then(this.validateFields)
			.tap(throwArgument)
			.tap(this.apply)
			.return(this);
	},

	fill: function( data ){
		var keys = Object.keys(data);

		for (var i = keys.length - 1;i >= 0;i--)
			if (!~this.fields.indexOf(keys[i]))
				throw new InputError(keys[i], 'Unknown key "' + keys[i] + '"');
			else
				this[keys[i]] = data[keys[i]];
	},

	validate: function(){
		return this
			.prepare()
			.bind(this)
			.then(this.validateFields)
			.tap(throwArgument);
	},

	validateFields: function(){
		return Promise
			.resolve(this.fields)
			.bind(this)
			.map(this.validateField)
			.filter(isDefined)
			.then(combineValidationErrors);
	},

	validateField: function( field ){
		debug('%s.validateField with field name %s', this.constructor.name, field);

		var validator = this.validators[field];

		if (validator)
			return Promise
				.join(validator(this, this[field]), field)
				.spread(normalize);
	},

	prepare: function(){},
	apply: function(){},
};

function throwArgument( e ){
	if (e)
		throw e;
}

function normalize( i, field ){
	// short circuit most common case
	if (i === undefined)
		return;

	if (typeof i === 'string')
		return new ValidationError(field, i);

	if (Array.isArray(i))
		return combineValidationErrors(i.map(normalize).filter(isDefined), field);

	if (i instanceof ValidationError)
		return i;
}

function combineValidationErrors( errors, field ){
	if (errors.length === 0)
		return;

	return new ValidationError(field, errors[0].message, errors);
}

function isDefined( r ){
	return r !== undefined;
}


// A ValidationError can contain multiple sub errors

function ValidationError( field, message, validationErrors ){
	this.field = field;
	this.message = message;
	this.errors = validationErrors;
}

ValidationError.prototype = Object.create(Error.prototype);

ValidationError.prototype.toJSON = function(){
	return toJSON(this);
};

function toJSON( error ){
	return {
		field: error.field,
		message: error.message,
		errors: error.errors && error.errors.map(toJSON),
	};
}

function InputError( field, message ){
	this.field = field;
	this.message = message;
}

InputError.prototype = Object.create(Error.prototype);
